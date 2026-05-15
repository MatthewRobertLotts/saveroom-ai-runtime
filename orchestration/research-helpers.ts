import { read_file, list_directory, save_artifact } from "./tool-executor";

function summarize(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 500);
}

export function supplierComparisonHelper(agent: string, paths: string[]): string {
  const summaries = paths.map((p) => {
    const result = read_file(agent, p);
    return `${p}: ${summarize(result.content || "")}`;
  });
  return summaries.join("\n");
}

export function productSetComparisonHelper(agent: string, paths: string[]): string {
  const summaries = paths.map((p) => {
    const result = read_file(agent, p);
    return `${p}: ${summarize(result.content || "")}`;
  });
  return summaries.join("\n");
}

export function inventoryTrendHelper(agent: string, directory: string): string {
  const result = list_directory(agent, directory);
  return `entries=${(result.entries || []).join(",")}`;
}

export function releaseTimelineHelper(agent: string, paths: string[]): string {
  const summaries = paths.map((p) => {
    const result = read_file(agent, p);
    return `${p}: ${summarize(result.content || "")}`;
  });
  return summaries.join("\n");
}

export function saveResearchArtifact(agent: string, targetPath: string, content: string): string {
  const result = save_artifact(agent, targetPath, content);
  return JSON.stringify(result, null, 2);
}
