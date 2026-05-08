import fs from "fs";
import path from "path";

export interface InsightRecord {
  source_workflow: string;
  department: string;
  timestamp: string;
  confidence: "low" | "medium" | "high";
  summary: string;
  tags: string[];
  related_domains: string[];
}

const workspaceRoot = path.resolve(__dirname, "..");
const insightsRoot = path.join(workspaceRoot, "insights");

function ensureDirs() {
  ["finance", "marketing", "research", "inventory", "runtime"].forEach((dir) => {
    fs.mkdirSync(path.join(insightsRoot, dir), { recursive: true });
  });
}

function log(message: string) {
  console.log(`[INSIGHTS] ${message}`);
}

export function publishInsight(record: InsightRecord): string {
  ensureDirs();
  const filePath = path.join(insightsRoot, record.department, `${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
  log(`published=${filePath}`);
  return filePath;
}

export function queryRelevantInsights(domains: string[], tags: string[]): InsightRecord[] {
  ensureDirs();
  const results: InsightRecord[] = [];

  for (const domain of ["finance", "marketing", "research", "inventory", "runtime"]) {
    const domainDir = path.join(insightsRoot, domain);
    if (!fs.existsSync(domainDir)) continue;
    for (const file of fs.readdirSync(domainDir)) {
      const fullPath = path.join(domainDir, file);
      try {
        const record = JSON.parse(fs.readFileSync(fullPath, "utf8")) as InsightRecord;
        const domainMatch = record.related_domains.some((item) => domains.includes(item));
        const tagMatch = record.tags.some((tag) => tags.includes(tag));
        if (domainMatch || tagMatch) results.push(record);
      } catch {
        continue;
      }
    }
  }

  return results;
}
