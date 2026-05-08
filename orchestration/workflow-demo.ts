import { runWorkflow } from "./workflow-engine";

function main() {
  runWorkflow("marketing-stream", {
    stream_theme: "Launch week",
    featured_languages: ["English", "Spanish"],
    featured_products: ["Starter bundle", "Pro bundle"],
    tone: "warm"
  });
}

main();
