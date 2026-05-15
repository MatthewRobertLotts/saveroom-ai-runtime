import fs from "fs";
import path from "path";

export interface RuntimeAgentRequest {
  agent: string;
  mode: string;
  task: string;
  return_to: string;
  approved?: boolean;
  workflow?: string;
}

export interface RuntimeContext {
  provider: string;
  model: string;
  source: string;
}

function log(message: string) {
  console.log(`[RUNTIME] ${message}`);
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

function loadAgentPrompt(agent: string): string {
  const filePath = path.resolve(__dirname, "..", "agents", `${agent.toLowerCase()}.md`);
  return readTextIfExists(filePath);
}

function loadModePrompt(mode: string): string {
  const filePath = path.resolve(__dirname, "..", "modes", `${mode}.md`);
  return readTextIfExists(filePath);
}

function loadEnvFile(): void {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim().replace(/^['\"]|['\"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

export function resolveRuntimeContext(): RuntimeContext {
  loadEnvFile();

  const envModel = process.env.OPENCLAW_MODEL || process.env.CLAWX_MODEL || process.env.MODEL;
  const envProvider = process.env.OPENCLAW_PROVIDER || process.env.CLAWX_PROVIDER || process.env.PROVIDER;

  if (envModel || envProvider) {
    return {
      provider: envProvider || "openrouter",
      model: envModel || "openai/gpt-4o-mini",
      source: "environment"
    };
  }

  const workspaceRoot = path.resolve(__dirname, "..", "..");
  const runtimeStatePath = path.join(workspaceRoot, "runtime-state.json");
  const runtimeState = readJsonIfExists(runtimeStatePath) as
    | { provider?: string; model?: string }
    | null;

  if (runtimeState?.model || runtimeState?.provider) {
    return {
      provider: runtimeState.provider || "openrouter",
      model: runtimeState.model || "openai/gpt-4o-mini",
      source: runtimeStatePath
    };
  }

  return {
    provider: process.env.SAVEROOM_DEFAULT_PROVIDER || "openrouter",
    model: process.env.SAVEROOM_DEFAULT_MODEL || "openai/gpt-4o-mini",
    source: "defaults"
  };
}

function resolveTavilyCommandSpecs(request: RuntimeAgentRequest): { specs: string[]; tavilyCommandName?: string } {
  const tavilyCommandName = "/tavily_search";
  const eligible = request.agent === "Professor Oak" && request.approved === true && (request.workflow || "").length > 0 && request.mode !== "delegation";
  if (!eligible) return { specs: [] };

  return {
    tavilyCommandName,
    specs: [
      `COMMAND SPEC: ${tavilyCommandName}`,
      `- scope: Professor Oak research workflows only`,
      `- usage: structured Tavily search/extract via OpenClaw native runtime`,
      `- approval: required and already granted for this workflow`
    ]
  };
}

function asSafeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function buildPrompt(request: RuntimeAgentRequest): string {
  const agentPrompt = asSafeString(loadAgentPrompt(request.agent));
  const modePrompt = asSafeString(loadModePrompt(request.mode));
  const task = asSafeString(request.task);
  const returnTo = asSafeString(request.return_to);
  const commandSpecs = resolveTavilyCommandSpecs(request);

  log(`command_specs_present=${commandSpecs.specs.length > 0 ? "yes" : "no"}`);
  log(`tavily_command_name=${commandSpecs.tavilyCommandName || "none"}`);
  log(`command_spec_count=${commandSpecs.specs.length}`);

  const sections = [
    `AGENT:\n${agentPrompt || request.agent}`,
    `MODE:\n${modePrompt || request.mode}`,
    `TASK:\n${task}`,
    `RETURN TO:\n${returnTo}`,
    commandSpecs.specs.length > 0 ? `COMMAND SPECS:\n${commandSpecs.specs.join("\n")}` : ""
  ].filter((section) => typeof section === "string" && section.trim().length > 0);

  log(`command_specs_injected_into_payload=${commandSpecs.specs.length > 0 ? "yes" : "no"}`);
  return sections.join("\n\n");
}

async function callOpenRouter(prompt: string, runtime: RuntimeContext): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for OpenRouter execution");
  }

  const promptValidation = validatePrompt(prompt);
  if (!promptValidation.ok) {
    throw new Error(`OpenRouter prompt validation failed: ${promptValidation.reason}`);
  }

  const systemMessage = asSafeString("Return only the exact task output requested by the mode.");
  const userMessage = asSafeString(prompt);
  const payload = {
    model: runtime.model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage }
    ]
  };

  log(`prompt_size=${prompt.length}`);
  log(`context_size=${Math.max(prompt.length - userMessage.length, 0)}`);
  log(`payload_validation=openrouter ok`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://openclaw.ai",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "SaveRoom"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || "";
}

async function callOpenAI(prompt: string, runtime: RuntimeContext): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for OpenAI execution");
  }

  const promptValidation = validatePrompt(prompt);
  if (!promptValidation.ok) {
    throw new Error(`OpenAI prompt validation failed: ${promptValidation.reason}`);
  }

  const systemMessage = asSafeString("Return only the exact task output requested by the mode.");
  const userMessage = asSafeString(prompt);
  const payload = {
    model: runtime.model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage }
    ]
  };

  log(`prompt_size=${prompt.length}`);
  log(`context_size=${Math.max(prompt.length - userMessage.length, 0)}`);
  log(`payload_validation=openai ok`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || "";
}

function validatePrompt(prompt: string): { ok: boolean; reason?: string } {
  if (typeof prompt !== "string") return { ok: false, reason: "prompt is not a string" };
  if (!prompt.trim()) return { ok: false, reason: "prompt is empty" };
  return { ok: true };
}

export async function runRuntimeAgent(request: RuntimeAgentRequest): Promise<string> {
  const runtime = resolveRuntimeContext();
  const prompt = buildPrompt(request);
  const promptValidation = validatePrompt(prompt);

  log(`provider=${runtime.provider}`);
  log(`model=${runtime.model}`);
  log(`finalisation_mode=${request.mode === "finalisation" ? "true" : "false"}`);
  log(`prompt_size=${prompt.length}`);

  if (!promptValidation.ok) {
    log(`execution=failure`);
    log(`payload_validation_failed=${promptValidation.reason}`);
    throw new Error(promptValidation.reason || "Invalid prompt");
  }

  try {
    let output = "";
    if (runtime.provider === "openai") {
      output = await callOpenAI(prompt, runtime);
    } else {
      output = await callOpenRouter(prompt, runtime);
    }

    if (!output.trim()) {
      throw new Error("Empty model response");
    }

    log(`execution=success`);
    return output;
  } catch (error) {
    log(`execution=failure`);
    log(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
