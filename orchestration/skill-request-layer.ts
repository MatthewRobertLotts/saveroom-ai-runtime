import fs from "fs";
import path from "path";

export interface SkillRequest {
  department: string;
  workflow: string;
  skill: string;
  approved: boolean;
}

export interface SkillResolution {
  outcome: "skill available" | "skill denied" | "skill missing" | "plugin disabled" | "permission mismatch" | "invocation failure";
  skill: string;
  department: string;
  workflow: string;
  timestamp: string;
  details?: string;
}

const workspaceRoot = path.resolve(__dirname, "..");
const registryPath = path.join(workspaceRoot, "orchestration", "department-skill-access-plan.md");
const governancePath = path.join(workspaceRoot, "reports", "runtime-planning", "skill-governance-model.md");

function log(message: string) {
  console.log(`[SKILL-REQUEST] ${message}`);
}

function now() {
  return new Date().toISOString();
}

function departmentAllowed(department: string, skill: string): boolean {
  const text = fs.readFileSync(registryPath, "utf8").toLowerCase();
  return text.includes(department.toLowerCase()) && text.includes(skill.toLowerCase());
}

function workflowApproved(workflow: string): boolean {
  const text = fs.readFileSync(governancePath, "utf8").toLowerCase();
  return text.includes("approval") && text.includes(workflow.toLowerCase());
}

function openClawSkillAvailable(skill: string): boolean {
  return skill.toLowerCase() === "tavily";
}

export function requestSkill(request: SkillRequest): SkillResolution {
  log(`requesting_department=${request.department}`);
  log(`requesting_workflow=${request.workflow}`);
  log(`requested_skill=${request.skill}`);
  log(`timestamp=${now()}`);

  if (!request.approved || !workflowApproved(request.workflow)) {
    return { outcome: "skill denied", skill: request.skill, department: request.department, workflow: request.workflow, timestamp: now(), details: "workflow not approved" };
  }

  if (!departmentAllowed(request.department, request.skill)) {
    return { outcome: "permission mismatch", skill: request.skill, department: request.department, workflow: request.workflow, timestamp: now(), details: "department not allowed" };
  }

  if (!openClawSkillAvailable(request.skill)) {
    return { outcome: "skill missing", skill: request.skill, department: request.department, workflow: request.workflow, timestamp: now(), details: "skill not found in native skill registry" };
  }

  try {
    const pluginEnabled = fs.readFileSync(path.join(workspaceRoot, "..", "..", "tmp", ".mount_ClawX-IjqJRP", "resources", "openclaw", "dist", "extensions", "tavily", "skills", "tavily", "SKILL.md"), "utf8").includes("plugins.entries.tavily.enabled");
    if (!pluginEnabled) {
      return { outcome: "plugin disabled", skill: request.skill, department: request.department, workflow: request.workflow, timestamp: now(), details: "tavily plugin disabled" };
    }
  } catch {
    return { outcome: "skill missing", skill: request.skill, department: request.department, workflow: request.workflow, timestamp: now(), details: "skill file missing" };
  }

  return { outcome: "skill available", skill: request.skill, department: request.department, workflow: request.workflow, timestamp: now() };
}
