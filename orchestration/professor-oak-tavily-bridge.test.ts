import { runProfessorOakTavily } from "./professor-oak-tavily-bridge";

function main() {
  const result = runProfessorOakTavily({
    department: "Professor Oak",
    workflow: "supplier-analysis",
    approved: true,
    task: "Research supplier and release context for a Pokémon product line."
  });

  console.log(JSON.stringify(result, null, 2));
}

main();
