import { describe, expect, it } from "vitest";
import { countWords, similarityScore } from "../src/domain/similarity.js";

describe("message similarity", () => {
  it("blocks exact and copied messages", () => {
    const prior = "Congratulations on five years with the team. We appreciate everything you bring to the organization each day.";
    expect(similarityScore(prior, prior).tooSimilar).toBe(true);
    expect(similarityScore(prior, `${prior} Enjoy your day!`).tooSimilar).toBe(true);
  });

  it("allows substantially different wording", () => {
    const result = similarityScore(
      "Congratulations on five years with the team. We appreciate everything you bring to the organization each day.",
      "Happy work anniversary, Jordan! Today marks an important milestone, and we hope you enjoy celebrating it with your colleagues."
    );
    expect(result.tooSimilar).toBe(false);
    expect(result.score).toBeLessThan(0.46);
  });

  it("counts words consistently", () => expect(countWords("One two  three\n four")).toBe(4));
});
