# Future Integrations

## Planned Integrations
- Tavily, structured research search for approved domains only
- Brave Search, bounded search for research workflows
- structured web search, only through approval and domain scoping
- supplier lookup, research and inventory only
- pricing lookup, finance and marketplace analysis only
- release lookup, research and inventory only
- OCR, already bounded for ingestion
- artifact persistence, already supported
- vector memory, scoped by domain
- embedding search, scoped by workflow and department
- reporting tools, for executive and departmental summaries

## Guardrails
- every integration must be permission checked
- every integration must be logged
- all external access must be approval gated
- no agent gets unrestricted browsing
- no agent gets universal search rights
- no agent gets raw shell access

## Rollout Rule
- prove usefulness in one department first
- add explicit allowlists
- keep fallback behavior safe and local
