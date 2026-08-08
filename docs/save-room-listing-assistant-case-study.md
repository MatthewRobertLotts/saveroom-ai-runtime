# SaveRoom Listing Assistant Case Study

## What this proves

A small, deterministic example of the AI application shape this runtime is intended to support: card/pricing signals become a structured listing draft, with validation and a human approval boundary before anything customer-facing happens.

## Workflow

```text
card + pricing signal
        │
        ▼
structured draft generation
        │
        ▼
validation / evidence fields
        │
        ▼
human approval required
        │
        ▼
listing workflow
```

## Why the demo is deterministic

The public repo avoids live model calls, private card databases, and marketplace credentials. The runnable demo keeps the shape visible without leaking data or pretending a hosted LLM key exists.

## Run

```bash
npm run case-study
```

## Production boundary

Model output would be treated as a draft only. Pricing, inventory, entitlement, and publication remain server-side SaveRoom API responsibilities.
