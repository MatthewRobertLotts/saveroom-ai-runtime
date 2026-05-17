# SaveRoom Operational Memory

## What This Is

This is SaveRoom's structured operational memory. It stores business knowledge that agents need to make good recommendations and run effective workflows. It is **not** a chatbot memory — it is a governed knowledge base with clear rules about what gets stored, when, and by whom.

## Directory Structure

```
memory/
  README.md                         ← You are here
  business-identity.json            ← Stable facts about SaveRoom
  product-performance.json          ← What has worked / not worked
  suppliers.json                    ← Supplier/source information
  stream-performance.json           ← Per-stream observations
  pricing-fees.json                 ← Financial rules and pricing logic
  packaging-operations.json         ← Operational rules and standards
  customer-community.json           ← Buyer/community insights
  decision-log.json                 ← Important business decisions
  schemas/
    *.schema.json                   ← JSON Schema for each domain
```

## Memory Domains

### 1. Business Identity (`business-identity.json`)
**What it stores:** Stable facts about SaveRoom — business type, platforms, brand values, red lines, product categories, current priorities.

**When to read:** At the start of any workflow that needs business context. Professor Oak reads this before research workflows. Gary reads this before marketing workflows.

**When to write:** Rarely. Only when the actual business model changes (new platform, new brand positioning, new product category). Requires Matthew's approval.

**What NOT to store:** Temporary observations, stream-specific data, supplier details, pricing experiments.

### 2. Product Performance (`product-performance.json`)
**What it stores:** Dated observations about how specific products or product types have performed — sell-through, audience response, margins, dead-stock risk.

**When to read:** Before sourcing decisions, stream planning, or profitability analysis. Professor Oak reads this for sourcing intelligence. Giovanni reads this for profit diagnostics.

**When to write:** After each stream or after a sourcing/purchasing decision. Each observation must include a date and confidence level.

**What NOT to store:** Permanent truths. Every record is a dated observation. One bad stream does not make a product "bad."

### 3. Suppliers (`suppliers.json`)
**What it stores:** Supplier/source information — reliability, pricing, delivery, minimum spend, useful product types, risk notes.

**When to read:** Before any sourcing decision. Professor Oak reads this for supplier analysis workflows.

**When to write:** After any supplier interaction (purchase, inquiry, issue). Update the existing supplier record rather than creating duplicates.

**What NOT to store:** Personal data of individual sellers. No names, addresses, or contact details of private individuals.

### 4. Stream Performance (`stream-performance.json`)
**What it stores:** Per-stream observations — what sold, what struggled, bundle performance, pacing, community response, lessons learned.

**When to read:** Before planning the next stream. Gary reads this for stream planning. Todd reads this for content creation.

**When to write:** After every stream. One record per stream. Must include the stream date.

**What NOT to store:** Permanent strategic conclusions from a single stream. Lessons learned should be flagged as observations, not rules.

### 5. Pricing & Fees (`pricing-fees.json`)
**What it stores:** Fee assumptions (Whatnot fees), pricing rules, margin observations, break-even warnings.

**When to read:** Before any pricing decision or profitability analysis. Giovanni reads this for finance analysis. Professor Oak reads this for sourcing recommendations.

**When to write:** When fee structures change, when new margin data is available, or when break-even thresholds are identified.

**What NOT to store:** Specific customer transaction data. Store aggregate observations, not individual sale records.

### 6. Packaging & Operations (`packaging-operations.json`)
**What it stores:** Packaging rules (sleeves, toploaders, padded envelopes), shipping standards, stream operational rules, red lines.

**When to read:** Before any operational workflow. Any agent involved in fulfillment or stream planning.

**When to write:** When Matthew changes an operational rule. These are stable rules, not observations.

**What NOT to store:** Temporary operational hiccups. Only store the current standard.

### 7. Customer & Community (`customer-community.json`)
**What it stores:** Trust signals, feedback patterns, community insights — what customers respond to, what damages trust.

**When to read:** Before marketing workflows, stream planning, or any customer-facing decision. Gary and Tracey read this for marketing. Professor Oak reads this for product research.

**When to write:** When a clear pattern emerges from multiple interactions. Not from a single comment or stream.

**What NOT to store:** Personal data about specific customers. No names, no order histories, no contact details. Patterns only, never individuals.

### 8. Decision Log (`decision-log.json`)
**What it stores:** Important business decisions — what was decided, by whom, why, and what happened.

**When to read:** Before making related decisions. Any agent should check the decision log before recommending something that reverses a previous decision.

**When to write:** After any significant business decision. Matthew or Ash should log decisions. Outcomes can be added later.

**What NOT to store:** Minor operational choices. Only log decisions that affect strategy, policy, or significant resource allocation.

## Memory Governance Rules

1. **Do not invent facts.** If you don't know something, leave it null or mark confidence as "low."
2. **Mark uncertain information clearly.** Every observation has a confidence level. Use it honestly.
3. **Separate stable rules from temporary observations.** Business identity and packaging rules are stable. Product performance and stream observations are temporary.
4. **Do not store private customer personal data.** Ever. Patterns only, never individuals.
5. **Do not treat one bad stream as permanent truth.** One data point is not a trend.
6. **Prefer dated observations over vague claims.** Every observation must have a date.
7. **Memory supports better decisions, it does not replace Matthew's judgement.** Agents cite memory sources when making recommendations. Matthew makes the final call.
8. **Human approval required before promoting observations to rules.** A pattern becomes a rule only when Matthew confirms it.

## How to Add New Memory After a Real Workflow

### After a Stream
1. Add a new record to `stream-performance.json` with the stream date.
2. Update `product-performance.json` with any new product observations (include date and confidence).
3. Update `customer-community.json` if new feedback patterns emerged.
4. Update `decision-log.json` if any decisions were made during the stream.

### After a Sourcing Decision
1. Update or create the supplier record in `suppliers.json`.
2. Add a product performance observation in `product-performance.json` (even pre-purchase expectations).
3. Log the decision in `decision-log.json`.

### After a Pricing Change
1. Update `pricing-fees.json` with the new pricing rule or fee observation.
2. Log the decision in `decision-log.json`.

### After a Customer Interaction Pattern
1. Update `customer-community.json` with the pattern (only if it's a repeated pattern, not a one-off).
2. Include the date range and confidence level.

## Schema Validation

Each domain has a JSON Schema in `memory/schemas/`. Use these to validate records before writing:

```bash
# Example: validate product performance schema
cd saveroom-ai
npx ajv validate -s memory/schemas/product-performance.schema.json -d memory/product-performance.json
```

## Agent Access Patterns

| Agent | Primary Memory Domains | Read/Write |
|-------|----------------------|------------|
| Professor Oak | product-performance, suppliers, pricing-fees, business-identity | Read-heavy, writes after research |
| Giovanni | pricing-fees, product-performance, decision-log | Read-heavy, writes after analysis |
| Gary | business-identity, stream-performance, customer-community, decision-log | Read-heavy, writes after planning |
| Todd | business-identity, stream-performance, packaging-operations | Read-only (creates content, not memory) |
| Tracey | business-identity, customer-community | Read-only (refines content, not memory) |
| Ash | All domains | Read-heavy, writes decisions to decision-log |
| Bill | All domains | Read-only (engineering, not business operations) |
