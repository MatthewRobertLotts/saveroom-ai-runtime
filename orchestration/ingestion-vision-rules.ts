export function classifyImageName(filename: string): { domain: string; routed: string[] } {
  const lower = filename.toLowerCase();
  if (lower.includes("screenshot") || lower.endsWith(".png") || lower.endsWith(".jpg")) {
    return { domain: "runtime", routed: ["Bill"] };
  }
  return { domain: "unknown", routed: [] };
}
