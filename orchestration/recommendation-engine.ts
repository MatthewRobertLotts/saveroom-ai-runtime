import fs from "fs";
import path from "path";

interface IngestionRecord {
  file: string;
  domain: string;
  type: string;
  metadata: Record<string, unknown>;
  routed_agents: string[];
}

interface Recommendation {
  detected_file: string;
  classification: string;
  suggested_department: string;
  suggested_workflows: string[];
  confidence: "low" | "medium" | "high";
  suggested_outputs: string[];
  approval_required: true;
}

const workspaceRoot = path.resolve(__dirname, "..");

function loadMemory(domain: string, file: string): unknown | null {
  const memoryPath = path.join(workspaceRoot, "memory", domain, `${file}.json`);
  if (!fs.existsSync(memoryPath)) return null;
  return JSON.parse(fs.readFileSync(memoryPath, "utf8"));
}

function confidenceFor(domain: string, memoryHit: boolean, routedCount: number): "low" | "medium" | "high" {
  if (memoryHit && routedCount > 0) return "high";
  if (domain !== "unknown" && routedCount > 0) return "medium";
  return "low";
}

export function recommend(record: IngestionRecord): Recommendation {
  const memoryHit = Boolean(loadMemory(record.domain, record.file));
  let suggestedDepartment = "Ash";
  let suggestedWorkflows: string[] = [];
  let suggestedOutputs: string[] = [];

  if (record.domain === "finance") {
    suggestedDepartment = "Giovanni";
    suggestedWorkflows = ["finance-analysis", "profitability-review"];
    suggestedOutputs = ["reports/finance-analysis/run-.../report.md", "reports/finance-analysis/run-.../profitability-summary.txt"];
  } else if (record.domain === "marketing") {
    suggestedDepartment = "Gary";
    suggestedWorkflows = ["marketing-stream", "shopify-listing"];
    suggestedOutputs = ["outputs/stream/title.txt", "outputs/listings/title.txt"];
  } else if (record.domain === "runtime") {
    suggestedDepartment = "Bill";
    suggestedWorkflows = ["runtime-review"];
    suggestedOutputs = ["reports/runtime/run-.../summary.md"];
  } else if (record.domain === "inventory") {
    suggestedDepartment = "Giovanni";
    suggestedWorkflows = ["finance-analysis"];
    suggestedOutputs = ["reports/finance-analysis/run-.../restock-recommendations.txt"];
  }

  return {
    detected_file: record.file,
    classification: record.domain,
    suggested_department: suggestedDepartment,
    suggested_workflows: suggestedWorkflows,
    confidence: confidenceFor(record.domain, memoryHit, record.routed_agents.length),
    suggested_outputs: suggestedOutputs,
    approval_required: true
  };
}
