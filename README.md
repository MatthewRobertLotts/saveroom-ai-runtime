<div align="center">
  <h1>SaveRoom AI Runtime</h1>
  <p><strong>TypeScript runtime and case-study demos for AI-assisted small-business operations workflows.</strong></p>
</div>

<p align="center">
  <a href="https://github.com/MatthewRobertLotts/saveroom-ai-runtime/actions/workflows/ci.yml"><img src="https://github.com/MatthewRobertLotts/saveroom-ai-runtime/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20+">
</p>

## What this is

SaveRoom AI Runtime is a TypeScript workspace for agent-style operations tooling: ingestion, workflow coordination, runtime adapters, memory notes, generated reports, and deterministic AI workflow case studies.

## Status

This is a public workbench plus case-study repo. It is kept public to show AI workflow design, TypeScript structure, and safe human-approval boundaries; production-ready SaveRoom systems live in the API/app repositories.

## Structure

```text
agents/          agent definitions and prompts
ingestion/       source ingestion experiments
memory/          local memory/context notes
modes/           runtime modes
orchestration/   runtime adapters and orchestration code
outputs/         generated outputs
reports/         planning and analysis reports
workflows/       workflow definitions
```

## Case study

The included listing-assistant demo shows the public shape of a SaveRoom AI workflow: card/pricing signal → structured listing draft → evidence fields → human approval required. It is deterministic on purpose: no private data, no live model key, no fake provider response.

```bash
npm run case-study
```

See [`docs/save-room-listing-assistant-case-study.md`](docs/save-room-listing-assistant-case-study.md).

## Quick start

```bash
git clone https://github.com/MatthewRobertLotts/saveroom-ai-runtime.git
cd saveroom-ai-runtime
npm ci
npm test
npm run demo
npm run case-study
```

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
