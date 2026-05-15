# Skill Governance Model

## Governance Layers
1. SaveRoom workflow governance decides what should happen.
2. Department governance decides who should request it.
3. OpenClaw skill governance decides whether the skill may execute.
4. OpenClaw executes the skill and enforces permission boundaries.

## Tavily Governance
- Tavily is assigned only to Professor Oak.
- Tavily requests must occur inside approved research workflows.
- Every request is logged.
- Every request must be permission-checked.
- No other department inherits access automatically.

## Approval Flow
- Workflow identifies need.
- Department head requests approved skill.
- OpenClaw checks permissions and scope.
- Skill executes or is rejected.
- Result returns to SaveRoom for synthesis.

## Safety Rules
- Department scopes are narrow.
- Skill access is explicit, not inherited globally.
- Approval is required for new or higher-risk skill usage.
- Logging is required for skill requests and results.

## Prohibitions
- No SaveRoom copy of skill execution runtime.
- No bypass of OpenClaw skill permissions.
- No hidden or ambient skill access.
- No unrestricted external capability growth.
