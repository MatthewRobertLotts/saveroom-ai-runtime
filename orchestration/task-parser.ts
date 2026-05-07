export type TaskMode = "delegation" | "execution" | "advisory" | "finalisation";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface TaskCall {
  type: "task_call";
  agent: string;
  mode: TaskMode;
  task: string;
  return_to: string;
  priority: TaskPriority;
}

const VALID_MODES = new Set<TaskMode>(["delegation", "execution", "advisory", "finalisation"]);
const VALID_PRIORITIES = new Set<TaskPriority>(["low", "normal", "high", "urgent"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return candidates;

  candidates.push(trimmed);

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  const objStart = trimmed.indexOf("{");
  const objEnd = trimmed.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    candidates.push(trimmed.slice(objStart, objEnd + 1));
  }

  return [...new Set(candidates)];
}

function validateTaskCall(value: unknown): TaskCall | null {
  if (!isObject(value)) return null;
  if (value.type !== "task_call") return null;
  if (typeof value.agent !== "string") return null;
  if (typeof value.mode !== "string" || !VALID_MODES.has(value.mode as TaskMode)) return null;
  if (typeof value.task !== "string") return null;
  if (typeof value.return_to !== "string") return null;
  if (typeof value.priority !== "string" || !VALID_PRIORITIES.has(value.priority as TaskPriority)) return null;

  return {
    type: "task_call",
    agent: value.agent,
    mode: value.mode as TaskMode,
    task: value.task,
    return_to: value.return_to,
    priority: value.priority as TaskPriority
  };
}

export function parseTaskCalls(rawOutput: string): { tasks: TaskCall[]; error?: string; details?: string[] } {
  const details: string[] = [];

  for (const candidate of extractJsonCandidates(rawOutput)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const tasks = values.map((value, index) => {
        const task = validateTaskCall(value);
        if (!task) details.push(`candidate validation failed at index ${index}`);
        return task;
      }).filter((task): task is TaskCall => task !== null);
      if (tasks.length > 0) return { tasks };
      details.push(`candidate parsed but contained no valid task_call objects`);
    } catch (error) {
      details.push(`JSON.parse failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
  }

  return { tasks: [], error: "No valid task_call JSON found", details };
}
