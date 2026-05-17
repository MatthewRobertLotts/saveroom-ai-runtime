import { processInbox } from "./ingestion-engine";

async function main() {
  const results = await processInbox();
  for (const result of results) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(`[RUNNER] fatal error: ${err}`);
  process.exit(1);
});
