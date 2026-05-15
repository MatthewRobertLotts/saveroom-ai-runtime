import { runSkillBridgeTest } from "./openclaw-skill-bridge";

function main() {
  const result = runSkillBridgeTest({
    department: "Professor Oak",
    workflow: "supplier-analysis",
    capability: "Tavily",
    approved: true
  });

  console.log(JSON.stringify(result, null, 2));
}

main();
