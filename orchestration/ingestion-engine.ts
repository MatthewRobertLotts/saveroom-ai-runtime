import fs from "fs";
import path from "path";
import { analyzeImage } from "./ingestion-image-analysis";

export type IngestionDomain = "finance" | "marketing" | "research" | "runtime" | "inventory" | "unknown";

interface IngestionRecord {
  file: string;
  domain: IngestionDomain;
  type: string;
  metadata: Record<string, unknown>;
  routed_agents: string[];
}

const workspaceRoot = path.resolve(__dirname, "..");
const ingestionRoot = path.join(workspaceRoot, "ingestion");
const memoryRoot = path.join(workspaceRoot, "memory");

function log(message: string) {
  console.log(`[INGESTION] ${message}`);
}

function ensureDirs() {
  ["inbox", "processing", "processed", "failed", "indexed"].forEach((dir) => {
    fs.mkdirSync(path.join(ingestionRoot, dir), { recursive: true });
  });
  ["finance", "marketing", "research", "inventory", "workflows", "runtime"].forEach((dir) => {
    fs.mkdirSync(path.join(memoryRoot, dir), { recursive: true });
  });
}

function classify(filename: string, content: string): { domain: IngestionDomain; routed: string[] } {
  const lower = `${filename}\n${content}`.toLowerCase();
  if (lower.includes("whatnot") || lower.includes("price") || lower.includes("supplier")) {
    return { domain: "finance", routed: ["Giovanni"] };
  }
  if (lower.includes("marketing") || lower.includes("caption") || lower.includes("campaign") || lower.includes("instagram")) {
    return { domain: "marketing", routed: ["Gary", "Todd", "Tracey"] };
  }
  if (lower.includes("runtime") || lower.includes("orchestrator") || lower.includes("log") || lower.includes("obs")) {
    return { domain: "runtime", routed: ["Bill"] };
  }
  if (lower.includes("inventory") || lower.includes("stock") || lower.includes("sku") || lower.includes("pokemon center")) {
    return { domain: "inventory", routed: ["Giovanni"] };
  }
  if (lower.includes("research") || lower.includes("analysis")) {
    return { domain: "research", routed: ["Giovanni"] };
  }
  return { domain: "unknown", routed: [] };
}

function extractMetadata(filePath: string, content: string): Record<string, unknown> {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  return {
    filename: path.basename(filePath),
    extension: ext,
    size: Buffer.byteLength(content, "utf8"),
    created_at: new Date().toISOString()
  };
}

function persistContext(domain: IngestionDomain, record: IngestionRecord) {
  const domainDir = path.join(memoryRoot, domain);
  fs.mkdirSync(domainDir, { recursive: true });
  const indexedPath = path.join(domainDir, `${path.basename(record.file)}.json`);
  fs.writeFileSync(indexedPath, JSON.stringify(record, null, 2), "utf8");
  log(`persistence_result=success path=${indexedPath}`);
}

export function processInboxFile(filePath: string): IngestionRecord {
  ensureDirs();
  const inboxFile = path.join(ingestionRoot, "inbox", path.basename(filePath));
  const processingFile = path.join(ingestionRoot, "processing", path.basename(filePath));
  const processedFile = path.join(ingestionRoot, "processed", path.basename(filePath));
  const failedFile = path.join(ingestionRoot, "failed", path.basename(filePath));

  fs.copyFileSync(inboxFile, processingFile);
  log(`detected_file=${inboxFile}`);

  const content = fs.readFileSync(processingFile, "utf8");
  const metadata = extractMetadata(processingFile, content);
  const imageAnalysis = /\.(png|jpg|jpeg)$/i.test(processingFile) ? analyzeImage(processingFile) : { success: false, text: "", tags: [] };
  log(`ocr=${imageAnalysis.success ? "success" : "failure"}`);
  log(`ocr_preview=${imageAnalysis.text}`);
  log(`semantic_tags=${imageAnalysis.tags.join(",") || "none"}`);
  const combinedContent = `${content}\n${imageAnalysis.text}\n${imageAnalysis.tags.join(" ")}`;
  const { domain, routed } = classify(processingFile, combinedContent);
  log(`adjusted_classification=${domain}`);
  log(`adjusted_confidence=${imageAnalysis.tags.length > 0 ? "high" : "medium"}`);
  log(`routed_agents=${routed.join(",") || "none"}`);
  log(`extracted_metadata=${JSON.stringify(metadata)}`);

  const record: IngestionRecord = {
    file: path.basename(filePath),
    domain,
    type: metadata.extension as string,
    metadata,
    routed_agents: routed
  };

  try {
    persistContext(domain, record);
    fs.copyFileSync(processingFile, processedFile);
    fs.unlinkSync(processingFile);
    return record;
  } catch (error) {
    fs.copyFileSync(processingFile, failedFile);
    fs.unlinkSync(processingFile);
    log(`persistence_result=failure path=${failedFile}`);
    throw error;
  }
}
