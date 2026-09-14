export const STARTING_SCORE = 0;

export function calculateScore(points: number[], capScore = true) {
  const credit = points.filter((point) => point > 0).reduce((sum, point) => sum + point, 0);
  const debit = Math.abs(points.filter((point) => point < 0).reduce((sum, point) => sum + point, 0));
  const raw = credit - debit;
  return { credit, debit, raw, score: raw };
}

export function classifyScore(score: number): "Tốt" | "Khá" | "Đạt" | "Chưa đạt" {
  if (score >= 10) return "Tốt";
  if (score >= 0) return "Khá";
  if (score >= -10) return "Đạt";
  return "Chưa đạt";
}
