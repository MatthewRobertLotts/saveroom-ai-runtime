import fs from "fs";
import path from "path";

interface AgentRecord {
  name: string;
  status: "active" | "inactive" | "experimental";
  reports_to: string;
  can_delegate: boolean;
  allowed_modes: string[];
}

interface RegistryFile {
  agents: AgentRecord[];
}

const workspaceRoot = path.resolve(__dirname, "..");

function loadRegistry(): RegistryFile {
  const filePath = path.join(workspaceRoot, "orchestration", "agent-registry.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as RegistryFile;
}

export function resolveAgent(name: string, explicitApproval = false): AgentRecord {
  const registry = loadRegistry();
  const agent = registry.agents.find((entry) => entry.name === name);

  if (!agent) {
    throw new Error(`Unknown agent rejected: ${name}`);
  }

  if (agent.status === "inactive") {
    throw new Error(`Inactive agent cannot be auto-selected: ${name}`);
  }

  if (agent.status === "experimental" && !explicitApproval) {
    throw new Error(`Experimental agent requires approval: ${name}`);
  }

  return agent;
}

export function canRouteTo(name: string, explicitApproval = false): boolean {
  try {
    resolveAgent(name, explicitApproval);
    return true;
  } catch (error) {
    console.log(`[ROUTING] ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
