import fs from "fs";
import path from "path";
import { extractImageContent, ImageExtractionResult } from "./ingestion-image-analysis";

export type IngestionDomain = "finance" | "marketing" | "research" | "runtime" | "inventory" | "unknown";

interface IngestionRecord {
  file: string;
  domain: IngestionDomain;
  type: string;
  metadata: Record<string, unknown>;
  routed_agents: string[];
  image_extraction?: ImageExtractionResult;
}

const workspaceRoot = path.resolve(__dirname, "..");
const ingestionRoot = path.join(workspaceRoot, "ingestion");
const memoryRoot = path.join(workspaceRoot, "memory");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function classify(filename: string, content: string): { domain: IngestionDomain; routed: string[] } {
  const lower = `${filename}\n${content}`.toLowerCase();
  if (lower.includes("whatnot") || lower.includes("price") || lower.includes("supplier") || lower.includes("sold")) {
    return { domain: "finance", routed: ["Giovanni"] };
  }
  if (lower.includes("marketing") || lower.includes("caption") || lower.includes("campaign") || lower.includes("instagram")) {
    return { domain: "marketing", routed: ["Gary", "Todd", "Tracey"] };
  }
  if (lower.includes("runtime") || lower.includes("orchestrator") || lower.includes("log") || lower.includes("obs")) {
    return { domain: "runtime", routed: ["Bill"] };
  }
  if (lower.includes("inventory") || lower.includes("stock") || lower.includes("sku") || lower.includes("pokemon center") || lower.includes("set") || lower.includes("product")) {
    return { domain: "inventory", routed: ["Giovanni", "Professor Oak"] };
  }
  if (lower.includes("research") || lower.includes("analysis") || lower.includes("release") || lower.includes("trend")) {
    return { domain: "research", routed: ["Professor Oak"] };
  }
  return { domain: "unknown", routed: [] };
}

function classifyFromExtraction(extraction: ImageExtractionResult): { domain: IngestionDomain; routed: string[] } {
  // Use the vision model's suggested memory domains to route
  const domains = extraction.suggested_memory_domains || [];
  const relevance = extraction.business_relevance || [];
  const text = `${extraction.summary}\n${extraction.visible_text}\n${extraction.detected_products.join(" ")}`.toLowerCase();

  // Check suggested memory domains first (from vision model)
  if (domains.includes("suppliers") || domains.includes("product_performance") || text.includes("supplier") || text.includes("buy price")) {
    return { domain: "inventory", routed: ["Giovanni", "Professor Oak"] };
  }
  if (domains.includes("stream_performance") || text.includes("stream") || text.includes("viewer") || text.includes("chat")) {
    return { domain: "research", routed: ["Professor Oak"] };
  }
  if (domains.includes("pricing_fees") || text.includes("fee") || text.includes("margin") || text.includes("profit")) {
    return { domain: "finance", routed: ["Giovanni"] };
  }
  if (domains.includes("customer_community") || text.includes("feedback") || text.includes("review")) {
    return { domain: "marketing", routed: ["Gary", "Tracey"] };
  }
  if (domains.includes("decision_log")) {
    return { domain: "research", routed: ["Professor Oak"] };
  }

  // Fallback to keyword matching on extracted text
  return classify(extraction.source_file, text);
}

function extractTextMetadata(filePath: string): Record<string, unknown> {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const stat = fs.statSync(filePath);
  return {
    filename: path.basename(filePath),
    extension: ext,
    size_bytes: stat.size,
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

/**
 * Process an image file through the vision extraction layer.
 * Images are read as binary/base64, sent to a vision-capable model,
 * and the structured result is attached to the ingestion record.
 */
async function processImageFile(
  inboxFile: string,
  processingFile: string,
  processedFile: string,
  failedFile: string
): Promise<IngestionRecord> {
  const basename = path.basename(inboxFile);
  log(`detected_file=${basename}`);
  log(`detected_type=image extension=${path.extname(inboxFile).toLowerCase()}`);

  // Step 1: Extract image content via vision model
  log(`extraction_route=vision_model`);
  const extraction = await extractImageContent(processingFile);

  if (extraction.error) {
    log(`extraction_error=${extraction.error}`);
  }

  // Step 2: Classify from extraction result
  const { domain, routed } = classifyFromExtraction(extraction);
  log(`classification=${domain}`);
  log(`routed_agents=${routed.join(",") || "none"}`);
  log(`extraction_confidence=${extraction.confidence}`);
  log(`needs_human_review=${extraction.needs_human_review}`);

  // Step 3: Build record with extraction attached
  const metadata = extractTextMetadata(processingFile);
  metadata.extraction = {
    model: extraction.extraction_model,
    confidence: extraction.confidence,
    products_found: extraction.detected_products.length,
    prices_found: extraction.prices.length,
    dates_found: extraction.dates.length,
    domains_suggested: extraction.suggested_memory_domains,
    needs_human_review: extraction.needs_human_review
  };

  const record: IngestionRecord = {
    file: basename,
    domain,
    type: "image",
    metadata,
    routed_agents: routed,
    image_extraction: extraction
  };

  // Step 4: Persist
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

/**
 * Process a text/file-based inbox item (non-image).
 * Original behavior preserved.
 */
function processTextFile(
  inboxFile: string,
  processingFile: string,
  processedFile: string,
  failedFile: string
): IngestionRecord {
  const basename = path.basename(inboxFile);
  log(`detected_file=${basename}`);
  log(`detected_type=text`);

  const content = fs.readFileSync(processingFile, "utf8");
  const metadata = extractTextMetadata(processingFile);
  const { domain, routed } = classify(basename, content);
  log(`classification=${domain}`);
  log(`routed_agents=${routed.join(",") || "none"}`);

  const record: IngestionRecord = {
    file: basename,
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

/**
 * Main entry: process a single inbox file.
 * Routes to image or text path based on file extension.
 */
export async function processInboxFile(filePath: string): Promise<IngestionRecord> {
  ensureDirs();
  const inboxFile = path.join(ingestionRoot, "inbox", path.basename(filePath));
  const processingFile = path.join(ingestionRoot, "processing", path.basename(filePath));
  const processedFile = path.join(ingestionRoot, "processed", path.basename(filePath));
  const failedFile = path.join(ingestionRoot, "failed", path.basename(filePath));

  fs.copyFileSync(inboxFile, processingFile);

  if (isImageFile(processingFile)) {
    return processImageFile(inboxFile, processingFile, processedFile, failedFile);
  }
  return processTextFile(inboxFile, processingFile, processedFile, failedFile);
}

/**
 * Process all files in the inbox directory.
 */
export async function processInbox(): Promise<IngestionRecord[]> {
  ensureDirs();
  const inboxDir = path.join(ingestionRoot, "inbox");
  const files = fs.readdirSync(inboxDir).filter((file) => {
    return fs.statSync(path.join(inboxDir, file)).isFile();
  });

  log(`inbox_count=${files.length}`);
  const results: IngestionRecord[] = [];

  for (const file of files) {
    try {
      const result = await processInboxFile(file);
      results.push(result);
    } catch (error) {
      log(`file_failed=${file} error=${error}`);
    }
  }

  log(`processed=${results.length}/${files.length}`);
  return results;
}
