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
  related_insights: unknown[];
  approval_required: true;
}

const workspaceRoot = path.resolve(__dirname, "..");

function loadMemory(domain: string, file: string): unknown | null {
  const memoryPath = path.join(workspaceRoot, "memory", domain, `${file}.json`);
  if (!fs.existsSync(memoryPath)) return null;
  return JSON.parse(fs.readFileSync(memoryPath, "utf8"));
}

function loadInsights(domain: string): unknown[] {
  const insightsDir = path.join(workspaceRoot, "insights", domain);
  if (!fs.existsSync(insightsDir)) return [];
  return fs.readdirSync(insightsDir).slice(0, 5).map((file) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(insightsDir, file), "utf8"));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function confidenceFor(domain: string, memoryHit: boolean, routedCount: number, insightCount: number): "low" | "medium" | "high" {
  if (memoryHit && routedCount > 0 && insightCount > 0) return "high";
  if (domain !== "unknown" && (routedCount > 0 || insightCount > 0)) return "medium";
  return "low";
}

export function recommend(record: IngestionRecord): Recommendation {
  const memoryHit = Boolean(loadMemory(record.domain, record.file));
  const relatedInsights = loadInsights(record.domain);
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
    suggestedDepartment = "Professor Oak";
    suggestedWorkflows = ["supplier-analysis", "inventory-opportunity-analysis"];
    suggestedOutputs = ["insights/research/run-.../inventory-opportunities.txt"];
  } else if (record.domain === "research") {
    suggestedDepartment = "Professor Oak";
    suggestedWorkflows = ["product-trend-analysis", "release-impact-analysis"];
    suggestedOutputs = ["insights/research/run-.../trend-summary.txt"];
  }

  return {
    detected_file: record.file,
    classification: record.domain,
    suggested_department: suggestedDepartment,
    suggested_workflows: suggestedWorkflows,
    confidence: confidenceFor(record.domain, memoryHit, record.routed_agents.length, relatedInsights.length),
    suggested_outputs: suggestedOutputs,
    related_insights: relatedInsights,
    approval_required: true
  };
}
