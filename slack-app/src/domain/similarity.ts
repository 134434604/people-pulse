const STOP_WORDS = new Set(["the", "and", "for", "with", "you", "your", "our", "are", "this", "that", "have", "from", "into", "thank"]);

export function normalizeForSimilarity(text: string): string {
  return text.toLowerCase()
    .replace(/hrma test record:.*$/g, " ")
    .replace(/\b(warmly|best|regards|sincerely),?\s+[a-z\s.'-]*$/g, " ")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestSharedWordRun(a: string, b: string): number {
  const left = a.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const right = b.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  let previous: number[] = [];
  let best = 0;
  for (const leftWord of left) {
    const current: number[] = [];
    right.forEach((rightWord, index) => {
      current[index] = leftWord === rightWord ? (previous[index - 1] ?? 0) + 1 : 0;
      best = Math.max(best, current[index] ?? 0);
    });
    previous = current;
  }
  return best;
}

function tokenSet(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z']+/g) ?? []).filter((word) => word.length > 3 && !STOP_WORDS.has(word)));
}

export function similarityScore(priorText: string, candidateText: string): { tooSimilar: boolean; score: number; reason: string } {
  const prior = normalizeForSimilarity(priorText);
  const candidate = normalizeForSimilarity(candidateText);
  if (!prior || !candidate) return { tooSimilar: false, score: 0, reason: "" };
  if (prior === candidate) return { tooSimilar: true, score: 1, reason: "exact_match" };
  if ((candidate.length >= 80 && prior.includes(candidate)) || (prior.length >= 80 && candidate.includes(prior))) {
    return { tooSimilar: true, score: 1, reason: "copied_message" };
  }
  if (longestSharedWordRun(prior, candidate) >= 14) return { tooSimilar: true, score: 1, reason: "long_copied_phrase" };
  const a = tokenSet(prior);
  const b = tokenSet(candidate);
  const union = new Set([...a, ...b]);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const score = union.size ? intersection / union.size : 0;
  return { tooSimilar: false, score, reason: "" };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
