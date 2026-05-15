import fs from "fs";
import path from "path";

/**
 * Agent Rehydrator
 *
 * Reloads an agent's operational context after provider/model switches.
 * No giant shared memory — each agent loads only its own domain-scoped files.
 *
 * Bootstrap loads in order:
 * 1. Identity  (agents/<name>.md)
 * 2. Role      (from agent-registry.json)
 * 3. Org structure (who they report to, who reports to them)
 * 4. Platform capabilities (workflow templates, available tools)
 * 5. Workspace state (last run ID, queue status)
 */

interface AgentIdentity {
  name: string;
  raw_prompt: string;
}

interface AgentRole {
  department: string;
  role: string;
  level: string;
  status: string;
  reports_to: string;
  allowed_modes: string[];
  core_responsibilities: string[];
}

interface OrgNode {
  name: string;
  role: string;
  relationship: "manager" | "peer" | "report";
}

interface OrgStructure {
  manager: OrgNode | null;
  peers: OrgNode[];
  reports: OrgNode[];
}

interface PlatformCapabilities {
  available_workflows: string[];
  available_tools: string[];
  skill_access: string[];
}

interface WorkspaceState {
  queue_length: number;
  last_run_id: string | null;
  outputs_count: number;
}

interface AgentBootstrapContext {
  identity: AgentIdentity;
  role: AgentRole;
  org: OrgStructure;
  capabilities: PlatformCapabilities;
  workspace: WorkspaceState;
  loaded_at: string;
}

const workspaceRoot = path.resolve(__dirname, "..");

function log(message: string) {
  console.log(`[REHYDRATE] ${message}`);
}

function readJsonIfExists(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readTextIfExists(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function loadAgentIdentity(agentName: string): AgentIdentity {
  const agentsDir = path.join(workspaceRoot, "agents");
  // Try exact match first, then normalized (spaces -> hyphens)
  const candidates = [
    path.join(agentsDir, `${agentName}.md`),
    path.join(agentsDir, `${agentName.replace(/\s+/g, "-")}.md`),
    path.join(agentsDir, `${agentName.toLowerCase()}.md`),
    path.join(agentsDir, `${agentName.toLowerCase().replace(/\s+/g, "-")}.md`)
  ];
  let raw = "";
  for (const candidate of candidates) {
    raw = readTextIfExists(candidate);
    if (raw) {
      log(`identity_loaded=${agentName} from=${path.basename(candidate)} size=${raw.length}`);
      break;
    }
  }
  if (!raw) {
    log(`identity_missing=${agentName}`);
  }
  return { name: agentName, raw_prompt: raw };
}

function loadAgentRole(agentName: string): AgentRole | null {
  const registry = readJsonIfExists(path.join(workspaceRoot, "orchestration", "agent-registry.json")) as
    | { agents: Array<Record<string, unknown>> }
    | null;

  if (!registry) {
    log("registry_not_found");
    return null;
  }

  const entry = registry.agents.find(
    (a) => (a.name as string).toLowerCase() === agentName.toLowerCase()
  );

  if (!entry) {
    log(`role_not_found=${agentName}`);
    return null;
  }

  return {
    department: entry.department as string,
    role: entry.role as string,
    level: entry.level as string,
    status: entry.status as string,
    reports_to: entry.reports_to as string,
    allowed_modes: (entry.allowed_modes as string[]) || [],
    core_responsibilities: (entry.core_responsibilities as string[]) || []
  };
}

function loadOrgStructure(agentName: string): OrgStructure {
  const registry = readJsonIfExists(path.join(workspaceRoot, "orchestration", "agent-registry.json")) as
    | { agents: Array<Record<string, unknown>> }
    | null;

  if (!registry) return { manager: null, peers: [], reports: [] };

  const agent = registry.agents.find(
    (a) => (a.name as string).toLowerCase() === agentName.toLowerCase()
  );

  if (!agent) return { manager: null, peers: [], reports: [] };

  const reportsTo = agent.reports_to as string;
  const agentDept = agent.department as string;

  const manager = registry.agents.find(
    (a) => (a.name as string) === reportsTo
  );

  const peers = registry.agents.filter(
    (a) =>
      (a.department as string) === agentDept &&
      (a.name as string) !== agentName
  );

  const reports = registry.agents.filter(
    (a) => (a.reports_to as string) === agentName
  );

  return {
    manager: manager
      ? { name: manager.name as string, role: manager.role as string, relationship: "manager" as const }
      : null,
    peers: peers.map((p) => ({ name: p.name as string, role: p.role as string, relationship: "peer" as const })),
    reports: reports.map((r) => ({ name: r.name as string, role: r.role as string, relationship: "report" as const }))
  };
}

function loadCapabilities(agentName: string): PlatformCapabilities {
  const workflows = readJsonIfExists(path.join(workspaceRoot, "orchestration", "workflow-templates.json")) as
    | { workflows: Array<Record<string, unknown>> }
    | null;

  const available: string[] = [];
  const skillAccess: string[] = [];

  if (workflows) {
    for (const wf of workflows.workflows) {
      const steps = (wf.execution_steps as Array<Record<string, unknown>>) || [];
      if (steps.some((s) => s.agent === agentName)) {
        available.push(wf.name as string);
      }
    }
  }

  // Skill access from capability matrix
  const matrixPath = path.join(workspaceRoot, "reports", "runtime-planning", "capability-matrix.md");
  const matrix = readTextIfExists(matrixPath);
  if (matrix) {
    // Find the agent's section and check for Tavily mention within it
    const sections = matrix.split(/^## /m);
    const agentSection = sections.find((s) =>
      s.toLowerCase().startsWith(agentName.toLowerCase()) ||
      s.toLowerCase().includes(`## ${agentName.toLowerCase()}`)
    );
    if (agentSection && agentSection.toLowerCase().includes("tavily")) {
      skillAccess.push("tavily");
    }
  }

  return {
    available_workflows: available,
    available_tools: ["read_file", "write_file", "list_directory", "save_artifact"],
    skill_access: skillAccess
  };
}

function loadWorkspaceState(): WorkspaceState {
  const queue = readJsonIfExists(path.join(workspaceRoot, "orchestration", "queue.json")) as string[] | null;
  const outputsDir = path.join(workspaceRoot, "outputs");

  let outputsCount = 0;
  if (fs.existsSync(outputsDir)) {
    const countFiles = (dir: string): number => {
      let count = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
        else count++;
      }
      return count;
    };
    outputsCount = countFiles(outputsDir);
  }

  return {
    queue_length: queue?.length || 0,
    last_run_id: null,
    outputs_count: outputsCount
  };
}

export function rehydrateAgent(agentName: string): AgentBootstrapContext {
  log(`rehydrating=${agentName}`);

  const identity = loadAgentIdentity(agentName);
  const role = loadAgentRole(agentName);
  const org = loadOrgStructure(agentName);
  const capabilities = loadCapabilities(agentName);
  const workspace = loadWorkspaceState();

  if (!role) {
    log(`rehydration_incomplete=${agentName} reason=role_not_found`);
  } else {
    log(`rehydration_complete=${agentName} dept=${role.department} level=${role.level} status=${role.status}`);
    log(`workflows=${capabilities.available_workflows.length} skills=${capabilities.skill_access.length}`);
    log(`org_manager=${org.manager?.name || "none"} peers=${org.peers.length} reports=${org.reports.length}`);
  }

  return {
    identity,
    role: role || {
      department: "unknown",
      role: "unknown",
      level: "unknown",
      status: "unknown",
      reports_to: "unknown",
      allowed_modes: [],
      core_responsibilities: []
    },
    org,
    capabilities,
    workspace,
    loaded_at: new Date().toISOString()
  };
}

export function formatBootstrapSummary(ctx: AgentBootstrapContext): string {
  const lines = [
    `# Agent Bootstrap Summary: ${ctx.identity.name}`,
    `- loaded_at: ${ctx.loaded_at}`,
    `- status: ${ctx.role.status}`,
    `- department: ${ctx.role.department}`,
    `- role: ${ctx.role.role}`,
    `- level: ${ctx.role.level}`,
    `- reports_to: ${ctx.role.reports_to}`,
    `- allowed_modes: ${ctx.role.allowed_modes.join(", ") || "none"}`,
    `- core_responsibilities: ${ctx.role.core_responsibilities.join(", ") || "none"}`,
    `- available_workflows: ${ctx.capabilities.available_workflows.join(", ") || "none"}`,
    `- skill_access: ${ctx.capabilities.skill_access.join(", ") || "none"}`,
    `- manager: ${ctx.org.manager?.name || "none"}`,
    `- peers: ${ctx.org.peers.map((p) => p.name).join(", ") || "none"}`,
    `- reports: ${ctx.org.reports.map((r) => r.name).join(", ") || "none"}`,
    `- workspace_queue: ${ctx.workspace.queue_length}`,
    `- workspace_outputs: ${ctx.workspace.outputs_count}`
  ];
  return lines.join("\n");
}

// CLI runner
if (require.main === module) {
  const agentName = process.argv[2];
  if (!agentName) {
    console.error("Usage: npx ts-node agent-bootstrap.ts <agent-name>");
    process.exit(1);
  }

  const ctx = rehydrateAgent(agentName);
  console.log(formatBootstrapSummary(ctx));
}
