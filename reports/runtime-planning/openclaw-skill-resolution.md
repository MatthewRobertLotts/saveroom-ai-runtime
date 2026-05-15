# OpenClaw Skill Resolution Notes

- Tavily skill exists under OpenClaw native skill paths.
- Tavily requires `plugins.entries.tavily.enabled`.
- SaveRoom should not hardcode Tavily as a direct integration.
- SaveRoom should request skills through OpenClaw governance and skill resolution.

## Diagnostics Required
- resolved skill name
- denied skill name
- missing skill path
- invocation failure reason
- workflow and department requesting the skill

## Boundary
- OpenClaw resolves and executes the skill.
- SaveRoom orchestrates workflow intent and approval flow.
