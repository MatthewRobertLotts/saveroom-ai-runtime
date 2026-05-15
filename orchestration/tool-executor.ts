import fs from "fs";
import path from "path";

export type ToolName = "read_file" | "write_file" | "list_directory" | "save_artifact";
export type DepartmentName = "Todd" | "Brock" | "Misty" | "Gary" | "Bill" | "Giovanni" | "Professor Oak";

export interface ToolRequest {
  tool: ToolName;
  agent: string;
  targetPath?: string;
  content?: string;
}

export interface ToolResult {
  success: boolean;
  verified_path: string;
  bytes_written: number;
  timestamp: string;
  error?: string;
  content?: string;
  entries?: string[];
}

const workspaceRoot = path.resolve(__dirname, "..");
const outputsRoot = path.join(workspaceRoot, "outputs");
const protectedPrefixes = [
  path.join(workspaceRoot, "orchestration"),
  path.join(workspaceRoot, "modes"),
  path.join(workspaceRoot, "agents")
];

function log(message: string) {
  console.log(`[TOOLS] ${message}`);
}

log(`resolved_workspace_root=${workspaceRoot}`);
log(`resolved_outputs_root=${outputsRoot}`);

const permissions: Record<string, ToolName[]> = {
  Todd: ["read_file", "write_file", "list_directory", "save_artifact"],
  Brock: ["read_file", "list_directory"],
  Misty: ["read_file", "list_directory"],
  Gary: ["read_file", "write_file", "list_directory", "save_artifact"],
  Bill: ["read_file", "write_file", "list_directory", "save_artifact"],
  Giovanni: ["read_file", "list_directory", "save_artifact"],
  "Professor Oak": ["read_file", "list_directory", "save_artifact"]
};

function now() {
  return new Date().toISOString();
}

function resolveSandboxPath(targetPath: string): string {
  const normalized = path.normalize(targetPath).replace(/^([/\\])+/, "");
  const resolved = path.resolve(workspaceRoot, normalized);
  if (!resolved.startsWith(workspaceRoot)) {
    throw new Error(`Path escapes workspace root: ${targetPath}`);
  }
  for (const protectedPrefix of protectedPrefixes) {
    if (resolved.startsWith(protectedPrefix)) {
      throw new Error(`Protected runtime path blocked: ${targetPath}`);
    }
  }
  return resolved;
}

function ensurePermission(agent: string, tool: ToolName) {
  const allowed = permissions[agent] || [];
  if (!allowed.includes(tool)) {
    throw new Error(`Agent ${agent} is not allowed to use ${tool}`);
  }
}

function verifyFileExists(resolved: string): boolean {
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
}

function resultBase(resolved: string): ToolResult {
  return {
    success: false,
    verified_path: resolved,
    bytes_written: 0,
    timestamp: now()
  };
}

export function read_file(agent: string, targetPath: string): ToolResult {
  ensurePermission(agent, "read_file");
  const resolved = resolveSandboxPath(targetPath);
  log(`tool=read_file agent=${agent} requested=${targetPath} actual=${resolved}`);

  const content = fs.readFileSync(resolved, "utf8");
  const exists = verifyFileExists(resolved);
  log(`verification=${exists ? "passed" : "failed"} path=${resolved}`);

  return {
    ...resultBase(resolved),
    success: exists,
    content,
    timestamp: now()
  };
}

export function list_directory(agent: string, targetPath: string): ToolResult {
  ensurePermission(agent, "list_directory");
  const resolved = resolveSandboxPath(targetPath);
  log(`tool=list_directory agent=${agent} requested=${targetPath} actual=${resolved}`);

  const exists = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  const entries = exists ? fs.readdirSync(resolved) : [];
  log(`verification=${exists ? "passed" : "failed"} path=${resolved}`);

  return {
    ...resultBase(resolved),
    success: exists,
    entries,
    timestamp: now()
  };
}

export function write_file(agent: string, targetPath: string, content: string): ToolResult {
  ensurePermission(agent, "write_file");
  const resolved = resolveSandboxPath(targetPath);
  log(`tool=write_file agent=${agent} requested=${targetPath} actual=${resolved}`);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, "utf8");
  const exists = verifyFileExists(resolved);
  const bytesWritten = Buffer.byteLength(content, "utf8");
  log(`verification=${exists ? "passed" : "failed"} path=${resolved}`);

  return {
    ...resultBase(resolved),
    success: exists,
    bytes_written: exists ? bytesWritten : 0,
    timestamp: now()
  };
}

export function save_artifact(agent: string, targetPath: string, content: string): ToolResult {
  ensurePermission(agent, "save_artifact");
  const normalizedTarget = path.normalize(targetPath).replace(/^([/\\])+/, "");
  const resolved = path.resolve(outputsRoot, normalizedTarget);
  if (!resolved.startsWith(outputsRoot)) {
    throw new Error(`Artifact path escapes outputs root: ${targetPath}`);
  }
  log(`tool=save_artifact agent=${agent} requested=${targetPath} actual=${resolved}`);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, "utf8");
  const exists = verifyFileExists(resolved);
  const bytesWritten = Buffer.byteLength(content, "utf8");
  log(`verification=${exists ? "passed" : "failed"} path=${resolved}`);

  return {
    ...resultBase(resolved),
    success: exists,
    bytes_written: exists ? bytesWritten : 0,
    timestamp: now()
  };
}
