import { runRuntimeAgent } from "./runtime-adapter";
import { parseTaskCalls } from "./task-parser";

interface Task {
  id: string;
  agent: string;
  mode: string;
  task: string;
  status: string;
  return_to: string;
  output?: string;
}

const queue: Task[] = [];

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
    return_to: task.return_to || "Ash"
  };
}

function enqueue(task: Task) {
  queue.push(task);
  log(`Enqueued ${task.agent} (${task.mode})`);
  log(`Queue length: ${queue.length}`);
}

async function runTask(task: Task) {
  task.status = "running";
  log(`Task lifecycle: ${task.agent} -> running`);

  log(`Running ${task.agent} in ${task.mode} mode`);

  const rawOutput = await runRuntimeAgent({
    agent: task.agent,
    mode: task.mode,
    task: task.task,
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
      log(`Task lifecycle: ${task.agent} -> failed`);
      return task.output;
    }

    log(`Parsed ${parsed.tasks.length} task_call(s) from ${task.agent}`);

    for (const parsedTask of parsed.tasks) {
      enqueue(createTask(parsedTask));
    }
  }

  task.output = rawOutput;
  task.status = "completed";

  log(`Task lifecycle: ${task.agent} -> completed`);
  log(`Completed ${task.agent}`);

  return task.output;
}

async function processQueue() {
  while (queue.length > 0) {
    log(`Queue length before shift: ${queue.length}`);
    const task = queue.shift();

    if (!task) continue;

    await runTask(task);
    log(`Queue length after task: ${queue.length}`);
  }
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
