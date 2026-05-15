# Memory Scope Plan

## Scope Model
- executive memory: Ash summaries, approvals, final decisions
- marketing memory: Gary, Todd, Tracey, campaign outputs
- finance memory: Giovanni, profitability, margin, fee, inventory economics
- research memory: Professor Oak, sourcing, release, product trends
- runtime memory: Bill, workflow state, orchestration diagnostics
- advisory memory: Brock and Misty, advisory notes only

## Rules
- no shared giant memory
- domain records only
- write summaries, not raw conversational dumps
- index by domain and workflow
- only pull relevant context into a workflow
- preserve determinism in retrieval where possible

## Retrieval Policy
- pull by domain match
- pull by tags and workflow name
- limit number of records injected
- exclude inactive or unrelated departments

## Forbidden Patterns
- free-form global recall
- cross-department mixing without explicit need
- automatic memory growth from every message
- unsandboxed agent chat logs
