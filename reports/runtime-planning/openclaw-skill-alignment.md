# OpenClaw Skill Alignment

SaveRoom should not duplicate skill execution. It should orchestrate organizational intent, then hand capability execution to OpenClaw-native skills.

## Alignment Principles
- SaveRoom owns workflow routing, approvals, insights, and departmental coordination.
- OpenClaw owns skill lifecycle, permission enforcement, and external capability abstraction.
- Department heads request skills through approved workflows, not direct unrestricted integrations.
- Skill execution remains scoped and logged by OpenClaw.
- SaveRoom only asks for skill output when workflow policy allows it.

## Operational Model
- Workflow selects department.
- Department selects approved skill set.
- OpenClaw validates access and runs the skill.
- Result returns to SaveRoom for synthesis, artifacting, or approval routing.

## Guardrails
- No parallel skill infrastructure inside SaveRoom.
- No direct unrestricted external APIs.
- No department-wide god access.
- No bypass of OpenClaw permissions.
