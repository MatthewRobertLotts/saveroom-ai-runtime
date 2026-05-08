import fs from "fs";

export interface ImageAnalysisResult {
  success: boolean;
  text: string;
  tags: string[];
}

function extractPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function analyzeImage(filePath: string): ImageAnalysisResult {
  const lower = filePath.toLowerCase();
  const text = extractPreview(lower);
  const tags: string[] = [];

  if (lower.includes("total sales") || lower.includes("revenue") || lower.includes("price") || lower.includes("whatnot")) {
    tags.push("finance");
  }
  if (lower.includes("instagram") || lower.includes("caption") || lower.includes("story")) {
    tags.push("marketing");
  }
  if (lower.includes("obs") || lower.includes("runtime") || lower.includes("orchestrator")) {
    tags.push("runtime");
  }
  if (lower.includes("pokemon center") || lower.includes("inventory") || lower.includes("stock")) {
    tags.push("inventory", "research");
  }

  return {
    success: true,
    text,
    tags: [...new Set(tags)]
  };
}
