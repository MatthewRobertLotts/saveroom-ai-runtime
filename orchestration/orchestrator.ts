import { runRuntimeAgent } from "./runtime-adapter";
import { parseTaskCalls } from "./task-parser";

interface Task {
  id: string;
  agent: string;
  mode: string;
  task: string;
  status: string;
  return_to: string;
  parentId?: string;
  output?: string;
}

interface WorkflowState {
  outputs: Record<string, string>;
  relationships: Record<string, string[]>;
  pendingChildren: Record<string, number>;
  resolvedParents: Record<string, boolean>;
  history: Array<{
    taskId: string;
    agent: string;
    mode: string;
    status: string;
    parentId?: string;
  }>;
  context: Record<string, unknown>;
}

const queue: Task[] = [];
const workflowState: WorkflowState = {
  outputs: {},
  relationships: {},
  pendingChildren: {},
  resolvedParents: {},
  history: [],
  context: {}
};
const seenDelegations = new Set<string>();
const workflowIterationCap = 100;
let workflowIterations = 0;

function log(message: string) {
  console.log(`[ORCHESTRATOR] ${message}`);
}

function logBlock(title: string, content: string) {
  console.log(`[ORCHESTRATOR] --- ${title} BEGIN ---`);
  console.log(content);
  console.log(`[ORCHESTRATOR] --- ${title} END ---`);
}

function createTask(task: Partial<Task>): Task {
  return {
    id: `task_${Date.now()}`,
    agent: task.agent || "Unknown",
    mode: task.mode || "execution",
    task: task.task || "",
    status: "queued",
    return_to: task.return_to || "Ash",
    parentId: task.parentId
  };
}

function buildFinalisationContext(parentId: string): string {
  const childIds = workflowState.relationships[parentId] || [];
  const childOutputs = childIds
    .map((id) => workflowState.outputs[id])
    .filter(Boolean)
    .join("\n\n");

  return childOutputs;
}

function recordHistory(task: Task) {
  workflowState.history.push({
    taskId: task.id,
    agent: task.agent,
    mode: task.mode,
    status: task.status,
    parentId: task.parentId
  });
}

function getContextForTask(task: Task): string {
  const childOutputs = task.parentId ? workflowState.relationships[task.parentId] || [] : [];
  const relatedOutputs = childOutputs
    .map((id) => workflowState.outputs[id])
    .filter(Boolean)
    .join("\n\n");

  const sharedContext = Object.entries(workflowState.context)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");

  return [relatedOutputs, sharedContext].filter(Boolean).join("\n\n");
}

function enqueue(task: Task) {
  queue.push(task);
  if (task.parentId) {
    workflowState.relationships[task.parentId] = workflowState.relationships[task.parentId] || [];
    workflowState.relationships[task.parentId].push(task.id);
    workflowState.pendingChildren[task.parentId] = (workflowState.pendingChildren[task.parentId] || 0) + 1;
    log(`Tracking child task for parent ${task.parentId}: ${workflowState.pendingChildren[task.parentId]} pending`);
  }
  log(`Enqueued ${task.agent} (${task.mode})`);
  log(`Queue length: ${queue.length}`);
}

async function runTask(task: Task) {
  task.status = "running";
  log(`Task lifecycle: ${task.agent} -> running`);

  log(`Running ${task.agent} in ${task.mode} mode`);

  const context = getContextForTask(task);
  const taskInput = context ? `${task.task}\n\nCONTEXT:\n${context}` : task.task;

  const rawOutput = await runRuntimeAgent({
    agent: task.agent,
    mode: task.mode,
    task: taskInput,
    return_to: task.return_to
  });

  logBlock(`RAW OUTPUT ${task.agent}`, rawOutput);
  if (task.mode === "delegation") {
    log(`Delegation output detected for ${task.agent}`);
  }

  if (task.mode === "delegation") {
    log(`Parsing task output for ${task.agent}`);
    const parsed = parseTaskCalls(rawOutput);
    if (parsed.tasks.length === 0) {
      log(`Task parsing failed for ${task.agent}`);
      log(`Parsing reason: ${parsed.error || "unknown error"}`);
      if (parsed.details?.length) {
        logBlock(`PARSE DETAILS ${task.agent}`, parsed.details.join("\n"));
      }
      logBlock(`PARSE FAILURE RAW OUTPUT ${task.agent}`, rawOutput);
      task.status = "failed";
      task.output = rawOutput;
      recordHistory(task);
      log(`Task lifecycle: ${task.agent} -> failed`);
      return task.output;
    }

    log(`Parsed ${parsed.tasks.length} task_call(s) from ${task.agent}`);

    for (const parsedTask of parsed.tasks) {
      const delegationKey = `${task.id}:${parsedTask.agent}:${parsedTask.mode}:${parsedTask.task}:${parsedTask.return_to}:${parsedTask.priority}`;
      if (seenDelegations.has(delegationKey)) {
        log(`Duplicate delegation skipped for ${parsedTask.agent}`);
        continue;
      }
      seenDelegations.add(delegationKey);
      enqueue(createTask({ ...parsedTask, parentId: task.id }));
    }
  } else {
    workflowState.outputs[task.id] = rawOutput;
    workflowState.context[task.id] = {
      agent: task.agent,
      mode: task.mode,
      output: rawOutput,
      parentId: task.parentId || null
    };

    if (task.parentId) {
        workflowState.pendingChildren[task.parentId] = Math.max((workflowState.pendingChildren[task.parentId] || 1) - 1, 0);
      log(`Child completion tracked for parent ${task.parentId}: ${workflowState.pendingChildren[task.parentId]} remaining`);
      if (workflowState.pendingChildren[task.parentId] === 0) {
        const finalisationContext = buildFinalisationContext(task.parentId);
        const parentHistory = workflowState.history.find((entry) => entry.taskId === task.parentId);
        const parentAgent = parentHistory?.agent || "Ash";
        const parentMode = parentHistory?.mode || "delegation";
        if (!workflowState.resolvedParents[task.parentId] && parentMode !== "finalisation") {
          workflowState.resolvedParents[task.parentId] = true;
          log(`Parent finalisation triggering for ${parentAgent} (${task.parentId})`);
          logBlock(`FINALISATION CONTEXT ${parentAgent}`, finalisationContext || "<empty>");
          enqueue(createTask({
            agent: parentAgent,
            mode: "finalisation",
            task: finalisationContext || "Finalize child outputs",
            return_to: "Ash",
            parentId: task.parentId
          }));
        } else {
          log(`Workflow resolution already recorded for parent ${task.parentId}, skipping requeue`);
        }
      }
      if (workflowState.pendingChildren[task.parentId] === 0) {
        delete workflowState.pendingChildren[task.parentId];
        log(`pendingChildren cleared for parent ${task.parentId}`);
      }
    }
  }

  task.output = rawOutput;
  task.status = "completed";
  recordHistory(task);

  if (task.mode === "finalisation") {
    log(`Finalisation completion recorded for ${task.agent} (${task.parentId || task.id})`);
    if (task.parentId) {
      workflowState.resolvedParents[task.parentId] = true;
      delete workflowState.pendingChildren[task.parentId];
      log(`Workflow resolution confirmed for parent ${task.parentId}`);
      log(`terminal workflow closure for parent ${task.parentId}`);
    }
  }

  log(`Task lifecycle: ${task.agent} -> completed`);
  log(`Completed ${task.agent}`);

  return task.output;
}

async function processQueue() {
  while (queue.length > 0) {
    workflowIterations += 1;
    if (workflowIterations > workflowIterationCap) {
      log(`Workflow iteration cap reached (${workflowIterationCap}), stopping to prevent runaway loops`);
      return;
    }
    log(`Queue length before shift: ${queue.length}`);
    const task = queue.shift();

    if (!task) continue;

    await runTask(task);
    log(`Queue length after task: ${queue.length}`);
  }

  log(`Workflow resolution complete, queue empty`);
}

async function main() {
  log("Starting SaveRoom orchestrator...");

  enqueue(
    createTask({
      agent: "Gary",
      mode: "delegation",
      task: "Create marketing workflow",
      return_to: "Ash"
    })
  );

  await processQueue();

  log("Workflow complete");
}

main();
