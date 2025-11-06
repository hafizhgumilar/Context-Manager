export type TextMetrics = {
  characters: number;
  words: number;
  tokens: number;
};

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

export function countWords(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return 0;
  }
  return normalized.split(" ").length;
}

export function estimateTokens(text: string) {
  if (!text.trim()) {
    return 0;
  }
  // Rough heuristic: 4 characters per token.
  return Math.max(1, Math.ceil(text.length / 4));
}

export function measureText(text: string): TextMetrics {
  return {
    characters: text.length,
    words: countWords(text),
    tokens: estimateTokens(text),
  };
}

