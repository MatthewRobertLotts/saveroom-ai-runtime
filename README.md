<div align="center">
  <h1>SaveRoom AI Runtime</h1>
  <p><strong>TypeScript experiments for AI-assisted small-business operations workflows.</strong></p>
</div>

<p align="center">
  <a href="https://github.com/MatthewRobertLotts/saveroom-ai-runtime/actions/workflows/ci.yml"><img src="https://github.com/MatthewRobertLotts/saveroom-ai-runtime/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20+">
</p>

## What this is

SaveRoom AI Runtime is an experimental TypeScript workspace for agent-style operations tooling: ingestion, workflow coordination, runtime adapters, memory notes, and generated reports.

## Status

This is a public workbench, not a polished product. It is kept public to show AI workflow design and TypeScript structure; production-ready SaveRoom systems live in the API/app repositories.

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

## Quick start

```bash
git clone https://github.com/MatthewRobertLotts/saveroom-ai-runtime.git
cd saveroom-ai-runtime
npm ci
npm test
npm run demo
```

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
