import fs from "fs";
import path from "path";
import { processInboxFile } from "./ingestion-engine";

const workspaceRoot = path.resolve(__dirname, "..");
const inboxDir = path.join(workspaceRoot, "ingestion", "inbox");

function main() {
  const files = fs.readdirSync(inboxDir).filter((file) => fs.statSync(path.join(inboxDir, file)).isFile());
  for (const file of files) {
    const result = processInboxFile(file);
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
