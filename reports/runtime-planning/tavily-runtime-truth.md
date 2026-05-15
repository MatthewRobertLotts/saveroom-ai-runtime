# Tavily Runtime Truth Document

## Two execution paths exist

### Path A: OpenClaw Plugin (primary for agent-native use)
- Plugin: `/tmp/.mount_ClawX-*/resources/openclaw/dist/extensions/tavily/`
- Tools: `tavily_search`, `tavily_extract`
- Auth: `TAVILY_API_KEY` env var OR `plugins.entries.tavily.config.webSearch.apiKey` in OpenClaw config
- Dispatch: OpenClaw runtime calls Tavily HTTP API directly
- Used when: OpenClaw skill commands are exposed to agents via skill command specs
- Status: ✅ Plugin exists, ✅ API key in config, ✅ Command specs injected for Professor Oak

### Path B: `tvly` CLI (skill-level fallback / direct use)
- Binary: `/home/saveroom/.local/bin/tavily` (installed via `uv`)
- Auth: `tvly login` (stores credentials locally)
- Usage: `tvly search "query" --json`
- Used when: Agent skill instructions invoke `tvly` directly via Bash tool
- Status: ✅ Installed, ❓ Login/credential state not verified

## Reconciliation

Both paths are valid and complementary:
- **Plugin path** is the native OpenClaw integration — preferred for governed agent workflows
- **CLI path** is the skill-level fallback — works when agents have Bash tool access

The previous session's finding that `tvly` was "not installed" was incorrect — it is installed at
`/home/saveroom/.local/bin/tvly` via `uv`. The session likely searched PATH incorrectly.

## Auth requirements

For Plugin path:
- `TAVILY_API_KEY` in OpenClaw config (present, redacted) OR
- `TAVILY_API_KEY` environment variable

For CLI path:
- `tvly login` must be run to store credentials

## What SaveRoom owns vs OpenClaw owns

SaveRoom:
- Governance (who can use Tavily, when, for what workflows)
- Command spec injection (which agents see Tavily commands)
- Workflow approval (Tavily only for approved research workflows)

OpenClaw:
- Plugin dispatch (actual HTTP calls to Tavily API)
- Credential resolution (API key → API calls)
- Tool execution (tavily_search, tavily_extract)

## Outdated assumptions to remove

- ❌ "tvly is not installed" — it IS installed
- ❌ "tvly login is the only auth path" — OpenClaw config API key also works
- ❌ "TAVILY_API_KEY must be in workspace .env" — OpenClaw config is sufficient
- ❌ "Plugin doesn't exist" — it exists and is enabled
