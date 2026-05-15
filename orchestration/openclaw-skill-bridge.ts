import fs from "fs";
import path from "path";

export interface SkillBridgeRequest {
  department: string;
  workflow: string;
  capability: string;
  approved: boolean;
  workspaceDir?: string;
}

export interface SkillBridgeResult {
  success: boolean;
  capability: string;
  department: string;
  workflow: string;
  timestamp: string;
  diagnostics: string[];
  error?: string;
}

const diagnosticsReportPath = path.resolve(__dirname, "..", "reports", "runtime-planning", "openclaw-skill-bridge-diagnostics.md");

function log(message: string) {
  console.log(`[SKILL-BRIDGE] ${message}`);
}

function now() {
  return new Date().toISOString();
}

function writeDiagnosticsReport(lines: string[]) {
  fs.mkdirSync(path.dirname(diagnosticsReportPath), { recursive: true });
  fs.writeFileSync(diagnosticsReportPath, lines.join("\n"), "utf8");
}

function locateOpenClawModule(): string | null {
  const candidates = [
    "/tmp/.mount_ClawX-4DmT91/resources/openclaw/dist/skills-Cwx5TftI.js",
    "/tmp/.mount_ClawX-IjqJRP/resources/openclaw/dist/skills-Cwx5TftI.js"
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadOpenClawSkillSurface(): { ok: boolean; modulePath?: string; error?: string } {
  const modulePath = locateOpenClawModule();
  if (!modulePath) return { ok: false, error: "OpenClaw skill runtime bundle not found" };
  return { ok: true, modulePath };
}

function departmentAllowed(department: string, capability: string): boolean {
  return department === "Professor Oak" && capability.toLowerCase() === "tavily";
}

export function runSkillBridgeTest(request: SkillBridgeRequest): SkillBridgeResult {
  const diagnostics: string[] = [];
  const reportLines: string[] = [];
  const surface = loadOpenClawSkillSurface();

  log(`requesting_department=${request.department}`);
  log(`requesting_workflow=${request.workflow}`);
  log(`requested_capability=${request.capability}`);
  log(`timestamp=${now()}`);

  reportLines.push(`# OpenClaw Skill Bridge Diagnostics`);
  reportLines.push(`- timestamp: ${now()}`);
  reportLines.push(`- requesting_department: ${request.department}`);
  reportLines.push(`- requesting_workflow: ${request.workflow}`);
  reportLines.push(`- requested_capability: ${request.capability}`);

  if (!surface.ok) {
    diagnostics.push(surface.error || "surface unavailable");
    reportLines.push(`- surface: blocked`);
    reportLines.push(`- error: ${surface.error || "unknown"}`);
    writeDiagnosticsReport(reportLines);
    return {
      success: false,
      capability: request.capability,
      department: request.department,
      workflow: request.workflow,
      timestamp: now(),
      diagnostics,
      error: surface.error || "OpenClaw skill surface unavailable"
    };
  }

  diagnostics.push(`openclaw_module=${surface.modulePath}`);
  reportLines.push(`- surface: found`);
  reportLines.push(`- module: ${surface.modulePath}`);

  if (!departmentAllowed(request.department, request.capability)) {
    diagnostics.push("permission mismatch");
    reportLines.push(`- permission: denied`);
    writeDiagnosticsReport(reportLines);
    return {
      success: false,
      capability: request.capability,
      department: request.department,
      workflow: request.workflow,
      timestamp: now(),
      diagnostics,
      error: "permission mismatch"
    };
  }

  diagnostics.push("Professor Oak permission check passed");
  reportLines.push(`- permission: Professor Oak allowed`);
  reportLines.push(`- capability: Tavily scoped only`);

  const nonApproved = departmentAllowed("Gary", request.capability);
  diagnostics.push(`non_approved_gary=${nonApproved ? "unexpected-pass" : "failed-as-expected"}`);
  reportLines.push(`- non_approved_agent_check: ${nonApproved ? "failed" : "passed"}`);

  writeDiagnosticsReport(reportLines);

  return {
    success: true,
    capability: request.capability,
    department: request.department,
    workflow: request.workflow,
    timestamp: now(),
    diagnostics
  };
}
