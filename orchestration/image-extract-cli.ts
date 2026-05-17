#!/usr/bin/env npx ts-node
/**
 * image-extract-cli.ts — CLI wrapper for single-image vision extraction.
 *
 * Usage:
 *   npx ts-node orchestration/image-extract-cli.ts <filepath>
 *
 * Output: JSON to stdout, logs to stderr.
 *
 * This is the tool agents should use to extract structured data from images
 * instead of trying to read image files directly (their models can't see images).
 */

import { extractImageContent } from "./ingestion-image-analysis";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npx ts-node orchestration/image-extract-cli.ts <filepath>");
    process.exit(1);
  }

  const filePath = args[0];

  // If the path is relative, resolve it against the saveroom-ai workspace
  const path = await import("path");
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  // Redirect module logs to stderr so stdout is clean JSON
  const origLog = console.log;
  console.log = (...a: unknown[]) => console.error(...a);

  try {
    const result = await extractImageContent(resolvedPath);
    // Restore stdout for the result
    console.log = origLog;
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.error ? 1 : 0);
  } catch (err) {
    console.log = origLog;
    console.error(`Fatal error: ${err}`);
    process.exit(1);
  }
}

main();
