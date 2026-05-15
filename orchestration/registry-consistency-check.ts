import fs from "fs";
import path from "path";

interface AgentEntry {
  name: string;
  department: string;
  role: string;
  level: string;
  status: string;
  reports_to: string;
  can_delegate: boolean;
  allowed_modes: string[];
  core_responsibilities: string[];
  activation_notes: string;
}

interface Registry {
  agents: AgentEntry[];
}

interface WorkflowTemplate {
  name: string;
  description: string;
  execution_steps: Array<{ agent: string; mode: string; task: string }>;
}

interface WorkflowFile {
  workflows: WorkflowTemplate[];
}

interface ConsistencyWarning {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  agent?: string;
}

const workspaceRoot = path.resolve(__dirname, "..");

function log(message: string) {
  console.log(`[REGISTRY-CHECK] ${message}`);
}

function loadRegistry(): Registry {
  const filePath = path.join(workspaceRoot, "orchestration", "agent-registry.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Registry;
}

function loadWorkflows(): WorkflowTemplate[] {
  const filePath = path.join(workspaceRoot, "orchestration", "workflow-templates.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as WorkflowFile;
  return data.workflows || [];
}

function loadAgentFiles(): string[] {
  const agentsDir = path.join(workspaceRoot, "agents");
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(".md", ""));
}

function loadBridgeFiles(): string[] {
  const orchDir = path.join(workspaceRoot, "orchestration");
  if (!fs.existsSync(orchDir)) return [];
  return fs.readdirSync(orchDir)
    .filter((f) => f.includes("-bridge") || f.includes("-tavily") || f.includes("skill-request"))
    .map((f) => f.replace(".ts", "").replace(".test", ""));
}

export function checkRegistryConsistency(): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = [];
  const registry = loadRegistry();
  const workflows = loadWorkflows();
  const agentFiles = loadAgentFiles();
  const bridgeFiles = loadBridgeFiles();

  const registeredNames = new Set(registry.agents.map((a) => a.name));
  const inactiveAgents = registry.agents.filter((a) => a.status !== "active");
  const activeAgents = registry.agents.filter((a) => a.status === "active");

  for (const agent of registry.agents) {
    // Check: agent file exists (handle "Professor Oak" -> "professor-oak.md")
    const normalizedName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileExists = agentFiles.some((f) => {
      const normalizedFile = f.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalizedFile === normalizedName;
    });
    if (!fileExists) {
      warnings.push({
        severity: "warning",
        category: "missing-agent-file",
        message: `No agent file found for ${agent.name} in agents/`,
        agent: agent.name
      });
    }

    // Check: duplicate names
    const duplicates = registry.agents.filter((a) => a.name === agent.name);
    if (duplicates.length > 1) {
      warnings.push({
        severity: "error",
        category: "duplicate-agent",
        message: `Duplicate agent name: ${agent.name} (${duplicates.length} entries)`,
        agent: agent.name
      });
    }

    // Check: reports_to references a valid agent
    if (agent.reports_to !== "user" && !registeredNames.has(agent.reports_to)) {
      warnings.push({
        severity: "error",
        category: "broken-reporting-line",
        message: `${agent.name} reports to "${agent.reports_to}" which is not in the registry`,
        agent: agent.name
      });
    }

    // Check: head agents should be active
    if (agent.level === "head" && agent.status !== "active") {
      warnings.push({
        severity: "error",
        category: "inactive-department-head",
        message: `Department head ${agent.name} (${agent.role}) is ${agent.status}`,
        agent: agent.name
      });
    }
  }

  // Check: inactive agents with active infrastructure
  for (const inactive of inactiveAgents) {
    // Check workflows referencing inactive agents
    for (const wf of workflows) {
      const steps = wf.execution_steps.filter((s) => s.agent === inactive.name);
      if (steps.length > 0) {
        warnings.push({
          severity: "warning",
          category: "workflow-for-inactive-agent",
          message: `Workflow "${wf.name}" has ${steps.length} step(s) for inactive agent ${inactive.name}`,
          agent: inactive.name
        });
      }
    }

    // Check bridge/tool files for inactive agents
    for (const bridge of bridgeFiles) {
      if (bridge.toLowerCase().includes(inactive.name.toLowerCase().replace(" ", "-"))) {
        warnings.push({
          severity: "warning",
          category: "bridge-for-inactive-agent",
          message: `Bridge/tool file "${bridge}" exists for inactive agent ${inactive.name}`,
          agent: inactive.name
        });
      }
    }
  }

  // Check: active agents without workflow coverage
  for (const active of activeAgents) {
    if (active.level === "specialist" || active.level === "head") {
      const hasWorkflow = workflows.some((wf) =>
        wf.execution_steps.some((s) => s.agent === active.name)
      );
      if (!hasWorkflow && active.name !== "Bill") {
        warnings.push({
          severity: "info",
          category: "no-workflow-coverage",
          message: `Active agent ${active.name} has no workflow step assignments`,
          agent: active.name
        });
      }
    }
  }

  // Check: agent files not in registry (normalized comparison)
  for (const file of agentFiles) {
    const normalizedFile = file.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matched = registry.agents.some((a) => {
      const normalizedAgent = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalizedAgent === normalizedFile;
    });
    if (!matched) {
      warnings.push({
        severity: "warning",
        category: "unregistered-agent-file",
        message: `Agent file ${file}.md exists but is not in the registry`,
        agent: file
      });
    }
  }

  // Summary
  const errors = warnings.filter((w) => w.severity === "error");
  const warns = warnings.filter((w) => w.severity === "warning");
  const infos = warnings.filter((w) => w.severity === "info");

  log(`registry_agents=${registry.agents.length} active=${activeAgents.length} inactive=${inactiveAgents.length}`);
  log(`workflows=${workflows.length} agent_files=${agentFiles.length} bridge_files=${bridgeFiles.length}`);
  log(`consistency_check_complete errors=${errors.length} warnings=${warns.length} info=${infos.length}`);

  return warnings;
}

// CLI runner
if (require.main === module) {
  const warnings = checkRegistryConsistency();
  const errors = warnings.filter((w) => w.severity === "error");

  console.log("\n=== Registry Consistency Report ===\n");

  for (const w of warnings) {
    const icon = w.severity === "error" ? "❌" : w.severity === "warning" ? "⚠️" : "ℹ️";
    console.log(`${icon} [${w.category}] ${w.message}`);
  }

  console.log(`\nTotal: ${warnings.length} findings (${errors.length} blocking)`);

  if (errors.length > 0) {
    process.exit(1);
  }
}
