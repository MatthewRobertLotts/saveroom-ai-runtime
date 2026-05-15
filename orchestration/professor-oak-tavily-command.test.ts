import { runRuntimeAgent } from "./runtime-adapter";

async function main() {
  const output = await runRuntimeAgent({
    agent: "Professor Oak",
    mode: "execution",
    task: "Use the Tavily command to research supplier and release context.",
    return_to: "Ash",
    approved: true,
    workflow: "supplier-analysis"
  });

  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
