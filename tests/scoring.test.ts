import { describe, expect, it } from "vitest";
import { calculateScore, classifyScore } from "../src/lib/scoring";

describe("scoring", () => {
  it("starts at 50 and separates credits from debits", () => {
    expect(calculateScore([2, -0.5, -5], false)).toEqual({ credit: 2, debit: 5.5, raw: 46.5, score: 46.5 });
  });

  it("caps the displayed score only when enabled", () => {
    expect(calculateScore([5], true).score).toBe(50);
    expect(calculateScore([5], false).score).toBe(55);
  });

  it.each([[41, "Tốt"], [40, "Khá"], [31, "Khá"], [30, "Đạt"], [21, "Đạt"], [20, "Chưa đạt"]] as const)("classifies %s as %s", (score, expected) => {
    expect(classifyScore(score)).toBe(expected);
  });
});
