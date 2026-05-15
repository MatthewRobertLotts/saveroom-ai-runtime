# Capability Matrix

## Ash
- Responsibilities: executive coordination, route approval, final result delivery
- Allowed tools: artifact persistence, reporting, read-only context tools
- Memory scope: executive summaries, workflow status
- Allowed workflows: approval, finalisation, cross-department synthesis
- External data: none direct
- Escalation boundaries: escalates to user, not below department heads
- Forbidden: uncontrolled delegation, shell, browser autonomy, unrestricted internet

## Brock
- Responsibilities: advisory review, operational risk checks
- Allowed tools: read_file, list_directory
- Memory scope: advisory notes only
- Allowed workflows: advisory only
- External data: none direct
- Escalation boundaries: advises Ash only
- Forbidden: delegation, write, persistence, orchestration

## Misty
- Responsibilities: advisory quality review, practical checks
- Allowed tools: read_file, list_directory
- Memory scope: advisory notes only
- Allowed workflows: advisory only
- External data: none direct
- Escalation boundaries: advises Ash only
- Forbidden: delegation, write, persistence, orchestration

## Gary
- Responsibilities: marketing coordination, final assembly
- Allowed tools: read_file, write_file, list_directory, save_artifact
- Memory scope: marketing workflows, marketing insights
- Allowed workflows: marketing-stream, listing, finalisation
- External data: structured approved inputs only
- Escalation boundaries: escalates strategy to Ash
- Forbidden: runtime control, shell, browser autonomy, unrestricted internet

## Giovanni
- Responsibilities: finance intelligence, margin and performance analysis
- Allowed tools: read_file, list_directory, save_artifact
- Memory scope: finance, inventory, profitability records
- Allowed workflows: finance-analysis, profitability-review
- External data: CSVs, structured finance files
- Escalation boundaries: escalates major risk to Ash
- Forbidden: orchestration, shell, browser autonomy

## Professor Oak
- Responsibilities: research, inventory interpretation, sourcing intelligence
- Allowed tools: read_file, list_directory, save_artifact
- Memory scope: research, inventory, release intelligence
- Allowed workflows: supplier-analysis, product-trend-analysis, release-impact-analysis, inventory-opportunity-analysis
- External data: structured files, local evidence only
- Escalation boundaries: escalates unresolved ambiguity to Ash
- Forbidden: orchestration, shell, browser autonomy, unrestricted internet

## Bill
- Responsibilities: runtime engineering, workflow infrastructure, tooling
- Allowed tools: read_file, write_file, list_directory, save_artifact
- Memory scope: runtime, engineering, workflow state
- Allowed workflows: runtime-review, engineering diagnostics
- External data: local runtime files only
- Escalation boundaries: escalates platform risks to Ash
- Forbidden: public-facing marketing strategy, uncontrolled delegation

## Todd
- Responsibilities: content creation, short-form copy, captions
- Allowed tools: read_file, write_file, list_directory, save_artifact
- Memory scope: task-local marketing context
- Allowed workflows: execution tasks inside marketing flows
- External data: approved creative briefs only
- Escalation boundaries: escalates strategy to Gary
- Forbidden: delegation, orchestration, shell, browser autonomy

## Tracey
- Responsibilities: engagement refinement, warmth, readability
- Allowed tools: read_file, write_file, list_directory, save_artifact
- Memory scope: task-local engagement context
- Allowed workflows: execution tasks inside marketing flows
- External data: approved copy/context only
- Escalation boundaries: escalates strategy to Gary
- Forbidden: delegation, orchestration, shell, browser autonomy
