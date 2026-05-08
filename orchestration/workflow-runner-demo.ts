import { runWorkflow } from "./workflow-engine";

async function main() {
  await runWorkflow("marketing-stream", {
    stream_theme: "Launch week",
    featured_languages: ["English", "Spanish"],
    featured_products: ["Starter bundle", "Pro bundle"],
    tone: "warm"
  });
}

main();
