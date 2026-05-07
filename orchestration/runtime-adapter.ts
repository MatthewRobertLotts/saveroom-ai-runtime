import fs from "fs";
import path from "path";

export interface RuntimeAgentRequest {
  agent: string;
  mode: string;
  task: string;
  return_to: string;
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

async function callOpenRouter(prompt: string, runtime: RuntimeContext): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for OpenRouter execution");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://openclaw.ai",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "SaveRoom"
    },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        { role: "system", content: "Return only the exact task output requested by the mode." },
        { role: "user", content: prompt }
      ]
    })
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        { role: "system", content: "Return only the exact task output requested by the mode." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || "";
}

function buildPrompt(request: RuntimeAgentRequest): string {
  const agentPrompt = loadAgentPrompt(request.agent);
  const modePrompt = loadModePrompt(request.mode);

  return [
    `AGENT:\n${agentPrompt || request.agent}`,
    `MODE:\n${modePrompt || request.mode}`,
    `TASK:\n${request.task}`,
    `RETURN TO:\n${request.return_to}`
  ].join("\n\n");
}

export async function runRuntimeAgent(request: RuntimeAgentRequest): Promise<string> {
  const runtime = resolveRuntimeContext();
  const prompt = buildPrompt(request);

  log(`provider=${runtime.provider}`);
  log(`model=${runtime.model}`);

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
