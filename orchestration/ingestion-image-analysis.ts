import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

// Load workspace .env so OPENROUTER_API_KEY and IMAGE_EXTRACTION_MODEL are available
dotenv.config({ path: path.join(process.env.HOME || "~", ".openclaw", "workspace-bill-head-of-engineering", "saveroom-ai", ".env") });

/**
 * Image Extraction Layer
 *
 * Reads image files from the ingest pipeline, sends them to a vision-capable
 * OpenRouter model, and returns structured text/JSON for downstream agents.
 *
 * This replaces the previous stub (filename-only keyword matching) with actual
 * vision model inference via the OpenAI-compatible OpenRouter API.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface VisionConfig {
  providerId: string;
  modelId: string;
  fallbackModelIds: string[];
  maxImageBytes: number;
  supportedMimeTypes: Record<string, string>;
}

// Allow env var override for the extraction model
function resolveModelId(): string {
  if (process.env.IMAGE_EXTRACTION_MODEL) {
    return process.env.IMAGE_EXTRACTION_MODEL;
  }
  return VISION_CONFIG.modelId;
}

const VISION_CONFIG: VisionConfig = {
  providerId: "custom-custom0d",
  // Primary: free vision model with image support, 262K ctx, no reasoning token overhead
  // Confirmed working: returns structured JSON from image payloads
  modelId: "google/gemma-4-26b-a4b-it:free",
  // Fallbacks: other free vision-capable models on OpenRouter
  fallbackModelIds: [
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
  ],
  maxImageBytes: 5 * 1024 * 1024,
  supportedMimeTypes: {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  }
};

// ---------------------------------------------------------------------------
// Extraction output schema
// ---------------------------------------------------------------------------

export interface ImageExtractionResult {
  source_file: string;
  input_type: "image";
  extraction_model: string;
  summary: string;
  visible_text: string;
  detected_products: string[];
  prices: string[];
  dates: string[];
  business_relevance: string[];
  suggested_memory_domains: string[];
  confidence: "low" | "medium" | "high";
  needs_human_review: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_RESULT: Omit<ImageExtractionResult, "source_file" | "input_type" | "extraction_model" | "error"> = {
  summary: "",
  visible_text: "",
  detected_products: [],
  prices: [],
  dates: [],
  business_relevance: [],
  suggested_memory_domains: [],
  confidence: "low",
  needs_human_review: true
};

function makeErrorResult(
  sourceFile: string,
  extractionModel: string,
  summary: string,
  errorMsg: string
): ImageExtractionResult {
  return {
    source_file: sourceFile,
    input_type: "image",
    extraction_model: extractionModel,
    ...EMPTY_RESULT,
    summary,
    error: errorMsg
  };
}

function getOpenClawConfigPath(): string {
  return path.join(process.env.HOME || "~", ".openclaw", "openclaw.json");
}

function readOpenClawConfig(): Record<string, unknown> {
  const configPath = getOpenClawConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
}

function getProviderApiKey(config: Record<string, unknown>, providerId: string): string | null {
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) return envKey;

  const workspaceEnv = path.join(
    process.env.HOME || "~",
    ".openclaw",
    "workspace-bill-head-of-engineering",
    "saveroom-ai",
    ".env"
  );
  if (fs.existsSync(workspaceEnv)) {
    const envContent = fs.readFileSync(workspaceEnv, "utf8");
    const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }

  return null;
}

function getProviderBaseUrl(config: Record<string, unknown>, providerId: string): string | null {
  const providers = (config.models as Record<string, unknown>)?.providers as Record<string, unknown> | undefined;
  const provider = providers?.[providerId] as Record<string, unknown> | undefined;
  return (provider?.baseUrl as string) || null;
}

function detectMimeType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return VISION_CONFIG.supportedMimeTypes[ext] || null;
}

function encodeImageToBase64(filePath: string): { data: string; mimeType: string } {
  const mimeType = detectMimeType(filePath);
  if (!mimeType) {
    throw new Error(`Unsupported image type: ${path.extname(filePath)}`);
  }
  const buffer = fs.readFileSync(filePath);

  // Free-tier vision models on OpenRouter reject large base64 payloads.
  // Keep raw image under ~115KB so base64 stays under ~150KB.
  // Larger images should be resized before placing in the ingest folder.
  const maxRawBytes = 500 * 1024; // ~667KB base64 — Gemma 4 has 262K ctx
  if (buffer.length > maxRawBytes) {
    throw new Error(
      `Image too large for free-tier vision model: ${buffer.length} bytes (max ${maxRawBytes}). ` +
      `Resize image to under 115KB before placing in ingest folder, or set IMAGE_EXTRACTION_MODEL to a paid model.`
    );
  }

  return { data: buffer.toString("base64"), mimeType };
}

// ---------------------------------------------------------------------------
// Vision model call
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `Analyze this image for SaveRoom (UK Pokémon TCG business). Extract ALL visible information.

Return ONLY this JSON (no markdown, no explanation):
{"summary":"1-2 sentence description of what this image shows","visible_text":"all text visible in the image with \\n for line breaks, mark unclear sections as [unreadable]","detected_products":["product name 1"],"prices":["£X.XX"],"dates":["date or date string"],"business_relevance":["sourcing|stream_performance|pricing|inventory|marketing|customer_feedback|supplier_info"],"suggested_memory_domains":["product_performance|suppliers|stream_performance|pricing_fees|customer_community|decision_log"],"confidence":"low|medium|high"}

Rules:
- Transcribe text exactly as shown. Do not guess or invent.
- Mark unclear sections as [unreadable].
- business_relevance: tag which SaveRoom business areas this relates to.
- suggested_memory_domains: suggest which memory domains should store observations from this image.
- Set confidence to low if anything is uncertain or image quality is poor.`;

async function callVisionModel(
  base64Data: string,
  mimeType: string,
  modelId: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const OpenAI = (await import("openai")).default;

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    defaultHeaders: {
      "HTTP-Referer": "https://saveroom.ai",
      "X-Title": "SaveRoom AI Image Extraction"
    }
  });

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: "user",
        content: [
          { type: "text" as const, text: EXTRACTION_PROMPT },
          {
            type: "image_url" as const,
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`
            }
          }
        ]
      }
    ],
    max_tokens: 1536
  });

  return response.choices[0]?.message?.content || "";
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function extractImageContent(filePath: string): Promise<ImageExtractionResult> {
  const sourceFile = path.basename(filePath);
  const log = (msg: string) => console.log(`[IMAGE-EXTRACT] ${msg}`);

  // Step 1: Detect file type
  const mimeType = detectMimeType(filePath);
  if (!mimeType) {
    const ext = path.extname(filePath).toLowerCase();
    log(`detected_type=unsupported extension=${ext}`);
    return makeErrorResult(sourceFile, "none", `Unsupported image type: ${ext}`, `Unsupported image type: ${ext}. Supported: ${Object.keys(VISION_CONFIG.supportedMimeTypes).join(", ")}`);
  }
  log(`detected_type=${mimeType}`);

  // Step 2: Read config and get API credentials
  let config: Record<string, unknown>;
  try {
    config = readOpenClawConfig();
  } catch (err) {
    log(`config_error=${err}`);
    return makeErrorResult(sourceFile, "none", "Failed to read OpenClaw configuration", `Config error: ${err}`);
  }

  const apiKey = getProviderApiKey(config, VISION_CONFIG.providerId);
  if (!apiKey) {
    log(`api_key=missing provider=${VISION_CONFIG.providerId}`);
    return makeErrorResult(sourceFile, "none", "No OpenRouter API key configured. Set OPENROUTER_API_KEY in environment or workspace .env.", "Missing OpenRouter API key");
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL || getProviderBaseUrl(config, VISION_CONFIG.providerId);
  if (!baseUrl) {
    log(`base_url=missing provider=${VISION_CONFIG.providerId}`);
    return makeErrorResult(sourceFile, "none", `No base URL configured for provider ${VISION_CONFIG.providerId}`, `Missing base URL for provider ${VISION_CONFIG.providerId}`);
  }

  // Step 3: Encode image
  let base64Data: string;
  try {
    const encoded = encodeImageToBase64(filePath);
    base64Data = encoded.data;
    log(`encoded_size=${Math.round(base64Data.length / 1024)}KB`);
  } catch (err) {
    log(`encode_error=${err}`);
    return makeErrorResult(sourceFile, "none", `Failed to encode image: ${err}`, `Encode error: ${err}`);
  }

  // Step 4: Try primary model, then fallbacks
  const primaryModel = resolveModelId();
  const modelsToTry = [primaryModel, ...VISION_CONFIG.fallbackModelIds.filter(m => m !== primaryModel)];
  let lastError = "";

  for (const modelId of modelsToTry) {
    log(`extraction_model=${modelId}`);
    try {
      const rawResponse = await callVisionModel(base64Data, mimeType, modelId, apiKey, baseUrl);
      log(`raw_response_length=${rawResponse.length}`);

      // Parse JSON from response (handle markdown code fences)
      let jsonStr = rawResponse.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(jsonStr);

      // Use model's business_relevance and suggested_memory_domains if provided,
      // otherwise derive from content as fallback
      const allText = `${parsed.summary || ""} ${parsed.visible_text || ""} ${(parsed.detected_products || []).join(" ")}`.toLowerCase();
      const derivedRelevance: string[] = [];
      const derivedDomains: string[] = [];
      if (allText.includes("price") || allText.includes("£") || allText.includes("cost") || allText.includes("margin") || allText.includes("fee")) {
        derivedRelevance.push("pricing");
        derivedDomains.push("pricing_fees");
      }
      if (allText.includes("supplier") || allText.includes("buy") || allText.includes("order") || allText.includes("invicta") || allText.includes("tcg")) {
        derivedRelevance.push("sourcing");
        derivedDomains.push("suppliers", "product_performance");
      }
      if (allText.includes("stream") || allText.includes("viewer") || allText.includes("chat") || allText.includes("live")) {
        derivedRelevance.push("stream_performance");
        derivedDomains.push("stream_performance");
      }
      if (allText.includes("inventory") || allText.includes("stock") || allText.includes("pack") || allText.includes("box")) {
        derivedRelevance.push("inventory");
        derivedDomains.push("product_performance");
      }
      if (allText.includes("customer") || allText.includes("feedback") || allText.includes("review")) {
        derivedRelevance.push("customer_feedback");
        derivedDomains.push("customer_community");
      }
      if (allText.includes("market") || allText.includes("campaign") || allText.includes("promo")) {
        derivedRelevance.push("marketing");
        derivedDomains.push("customer_community");
      }
      if (derivedRelevance.length === 0) {
        derivedRelevance.push("sourcing");
        derivedDomains.push("product_performance");
      }

      const businessRelevance: string[] = Array.isArray(parsed.business_relevance) && parsed.business_relevance.length > 0
        ? parsed.business_relevance.map(String)
        : derivedRelevance;
      const suggestedDomains: string[] = Array.isArray(parsed.suggested_memory_domains) && parsed.suggested_memory_domains.length > 0
        ? parsed.suggested_memory_domains.map(String)
        : derivedDomains;

      const result: ImageExtractionResult = {
        source_file: sourceFile,
        input_type: "image",
        extraction_model: modelId,
        summary: parsed.summary || "",
        visible_text: parsed.visible_text || "",
        detected_products: Array.isArray(parsed.detected_products) ? parsed.detected_products.map(String) : [],
        prices: Array.isArray(parsed.prices) ? parsed.prices.map(String) : [],
        dates: Array.isArray(parsed.dates) ? parsed.dates.map(String) : [],
        business_relevance: [...new Set(businessRelevance)],
        suggested_memory_domains: [...new Set(suggestedDomains)],
        confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
        needs_human_review: true // always true for image-derived data
      };

      log(`extraction=success confidence=${result.confidence} products=${result.detected_products.length} prices=${result.prices.length} dates=${result.dates.length} domains=${result.suggested_memory_domains.length}`);
      return result;

    } catch (err) {
      lastError = `${err}`;
      log(`model_failed=${modelId} error=${lastError}`);
    }
  }

  // All models failed
  log(`extraction=failure all_models_failed`);
  return makeErrorResult(sourceFile, modelsToTry.join(", "), "All vision models failed to process this image.", `All models failed. Last error: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Synchronous wrapper for backward compatibility
// ---------------------------------------------------------------------------

export function analyzeImage(filePath: string): {
  success: boolean;
  text: string;
  tags: string[];
  extraction?: ImageExtractionResult;
} {
  const mimeType = detectMimeType(filePath);

  if (!mimeType) {
    return { success: false, text: "", tags: [] };
  }

  return {
    success: true,
    text: `[IMAGE:${mimeType}]`,
    tags: ["image", "needs_vision_extraction"],
    extraction: undefined
  };
}
