import fs from "fs";
import path from "path";

/**
 * Skill-to-Plugin Config Sync Layer
 *
 * Detects API credentials configured at the skill layer (via ClawX UI) that have
 * corresponding native plugin runtime entries, and hydrates the plugin config
 * namespace so the native provider can resolve auth without manual duplication.
 *
 * Design principles:
 * - No secret logging: keys are never printed, logged, or written to reports
 * - Minimal writes: only patches the specific plugin config paths that need it
 * - Extensible: new skill→plugin mappings are added to SYNC_MAPPINGS, not hardcoded
 * - Preserves ownership: OpenClaw still owns plugin execution; this is just config plumbing
 */

// ---------------------------------------------------------------------------
// Mapping registry: skill entry → plugin entry + credential path
// ---------------------------------------------------------------------------

interface SyncMapping {
  /** Skill entry key under skills.entries.<key> */
  skillKey: string;
  /** Plugin entry key under plugins.entries.<key> */
  pluginKey: string;
  /** Dot-path within the skill entry where the API key lives (e.g. "apiKey") */
  skillCredentialPath: string;
  /**
   * Dot-path within the plugin entry config where the key should be written.
   * If the plugin uses a nested config object, specify the full path
   * (e.g. "config.webSearch.apiKey").
   */
  pluginCredentialPath: string;
  /** Human-readable capability name for diagnostics */
  capability: string;
}

/**
 * Add new mappings here for future skill→plugin credential syncs.
 * Each entry is self-contained: skill key, plugin key, and both credential paths.
 */
const SYNC_MAPPINGS: SyncMapping[] = [
  {
    skillKey: "tavily-search",
    pluginKey: "tavily",
    skillCredentialPath: "apiKey",
    pluginCredentialPath: "config.webSearch.apiKey",
    capability: "webSearch"
  }
];

// ---------------------------------------------------------------------------
// OpenClaw config helpers
// ---------------------------------------------------------------------------

function getOpenClawConfigPath(): string {
  return path.join(process.env.HOME || "~", ".openclaw", "openclaw.json");
}

function readConfig(): Record<string, unknown> {
  const configPath = getOpenClawConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
}

function writeConfig(config: Record<string, unknown>): void {
  const configPath = getOpenClawConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Nested value helpers (get / set by dot-path)
// ---------------------------------------------------------------------------

function getNested(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNested(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const parts = dotPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function hasNested(obj: Record<string, unknown>, dotPath: string): boolean {
  return getNested(obj, dotPath) !== undefined;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface SyncDiagnostic {
  mapping: SyncMapping;
  skillConfigPresent: boolean;
  pluginConfigPresent: boolean;
  syncApplied: boolean;
  valuesSynchronized: boolean;
  runtimeReady: boolean;
  /** Non-secret detail (e.g. "skill key present, plugin key absent") */
  detail: string;
}

export interface SyncReport {
  timestamp: string;
  diagnostics: SyncDiagnostic[];
  totalMappings: number;
  syncsApplied: number;
  runtimeReadyCount: number;
  allReady: boolean;
}

/**
 * Run diagnostics only (read-only, no config changes).
 */
export function diagnoseSync(): SyncReport {
  const config = readConfig();
  const skillsEntries = (config.skills as Record<string, unknown>)?.entries as Record<string, unknown> | undefined;
  const pluginsEntries = (config.plugins as Record<string, unknown>)?.entries as Record<string, unknown> | undefined;

  const diagnostics: SyncDiagnostic[] = [];
  let syncsApplied = 0;
  let runtimeReadyCount = 0;

  for (const mapping of SYNC_MAPPINGS) {
    const skillEntry = skillsEntries?.[mapping.skillKey] as Record<string, undefined> | undefined;
    const skillConfigPresent = skillEntry !== undefined;
    const skillCredential = skillConfigPresent
      ? getNested(skillEntry as Record<string, unknown>, mapping.skillCredentialPath)
      : undefined;
    const skillHasCredential = skillCredential !== undefined && skillCredential !== null && skillCredential !== "";

    const pluginEntry = pluginsEntries?.[mapping.pluginKey] as Record<string, unknown> | undefined;
    const pluginConfigPresent = pluginEntry !== undefined;
    const pluginCredential = pluginConfigPresent
      ? getNested(pluginEntry, mapping.pluginCredentialPath)
      : undefined;
    const pluginHasCredential = pluginCredential !== undefined && pluginCredential !== null && pluginCredential !== "";

    const valuesSynchronized = skillHasCredential && pluginHasCredential;
    const runtimeReady = pluginHasCredential; // runtime only reads from plugin namespace

    let detail: string;
    let syncApplied = false;

    if (!skillConfigPresent && !pluginConfigPresent) {
      detail = "Neither skill nor plugin configured";
    } else if (!skillConfigPresent) {
      detail = "Skill not configured; plugin config present (standalone)";
    } else if (!skillHasCredential) {
      detail = "Skill entry exists but no credential set";
    } else if (!pluginConfigPresent) {
      detail = "Skill credential present; plugin entry missing — sync needed";
      syncApplied = true; // would be applied in write mode
    } else if (!pluginHasCredential) {
      detail = "Skill credential present; plugin config missing credential — sync needed";
      syncApplied = true; // would be applied in write mode
    } else if (valuesSynchronized) {
      detail = "Both sides configured and synchronized";
    } else {
      detail = "Unknown state";
    }

    if (syncApplied) syncsApplied++;
    if (runtimeReady) runtimeReadyCount++;

    diagnostics.push({
      mapping,
      skillConfigPresent,
      pluginConfigPresent,
      syncApplied,
      valuesSynchronized,
      runtimeReady,
      detail
    });
  }

  return {
    timestamp: new Date().toISOString(),
    diagnostics,
    totalMappings: SYNC_MAPPINGS.length,
    syncsApplied,
    runtimeReadyCount,
    allReady: runtimeReadyCount === SYNC_MAPPINGS.length
  };
}

/**
 * Apply sync: hydrate plugin config from skill config where needed.
 * Returns the diagnostics report (with syncApplied reflecting what was actually written).
 */
export function applySync(): SyncReport {
  const config = readConfig();
  const report = diagnoseSync();

  for (const diagnostic of report.diagnostics) {
    if (!diagnostic.syncApplied) continue;

    const mapping = diagnostic.mapping;
    const skillsEntries = (config.skills as Record<string, unknown>).entries as Record<string, unknown>;
    const skillEntry = skillsEntries[mapping.skillKey] as Record<string, unknown>;
    const skillCredential = getNested(skillEntry, mapping.skillCredentialPath);

    // Ensure plugins.entries exists
    if (!config.plugins) {
      config.plugins = { entries: {} };
    }
    const pluginsConfig = config.plugins as Record<string, unknown>;
    if (!pluginsConfig.entries) {
      pluginsConfig.entries = {};
    }
    const pluginsEntries = pluginsConfig.entries as Record<string, unknown>;

    // Ensure plugin entry exists
    if (!pluginsEntries[mapping.pluginKey]) {
      pluginsEntries[mapping.pluginKey] = { enabled: true };
    }
    const pluginEntry = pluginsEntries[mapping.pluginKey] as Record<string, unknown>;

    // Set the credential at the plugin path
    setNested(pluginEntry, mapping.pluginCredentialPath, skillCredential);

    // Mark as actually applied
    diagnostic.syncApplied = true;
    diagnostic.pluginConfigPresent = true;
    diagnostic.valuesSynchronized = true;
    diagnostic.runtimeReady = true;
    diagnostic.detail = "Sync applied: skill credential hydrated into plugin config";
  }

  // Only write if something was actually synced
  if (report.diagnostics.some((d) => d.syncApplied)) {
    writeConfig(config);
  }

  // Recompute summary
  report.syncsApplied = report.diagnostics.filter((d) => d.syncApplied).length;
  report.runtimeReadyCount = report.diagnostics.filter((d) => d.runtimeReady).length;
  report.allReady = report.runtimeReadyCount === report.totalMappings;

  return report;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatSyncReport(report: SyncReport): string {
  const lines = [
    `# Skill→Plugin Config Sync Report`,
    `- timestamp: ${report.timestamp}`,
    `- mappings: ${report.totalMappings}`,
    `- syncs applied: ${report.syncsApplied}`,
    `- runtime ready: ${report.runtimeReadyCount}/${report.totalMappings}`,
    `- all ready: ${report.allReady}`,
    ``
  ];

  for (const d of report.diagnostics) {
    lines.push(`## ${d.mapping.capability} (${d.mapping.skillKey} → ${d.mapping.pluginKey})`);
    lines.push(`- skill config: ${d.skillConfigPresent ? "present" : "absent"}`);
    lines.push(`- plugin config: ${d.pluginConfigPresent ? "present" : "absent"}`);
    lines.push(`- sync applied: ${d.syncApplied ? "yes" : "no"}`);
    lines.push(`- values synchronized: ${d.valuesSynchronized ? "yes" : "no"}`);
    lines.push(`- runtime ready: ${d.runtimeReady ? "yes" : "no"}`);
    lines.push(`- detail: ${d.detail}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

if (require.main === module) {
  const mode = process.argv[2] || "diagnose";

  if (mode === "diagnose") {
    const report = diagnoseSync();
    console.log(formatSyncReport(report));
    process.exit(report.allReady ? 0 : 1);
  } else if (mode === "sync") {
    const report = applySync();
    console.log(formatSyncReport(report));
    process.exit(report.allReady ? 0 : 1);
  } else {
    console.error("Usage: npx ts-node skill-plugin-config-sync.ts [diagnose|sync]");
    process.exit(2);
  }
}
