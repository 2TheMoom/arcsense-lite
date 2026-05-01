export function generateTrend(prev: number, current: number): string {
  if (prev === 0 && current > 0) return "Emerging failure signal";
  if (current === 0 && prev > 0) return "Failures fully cleared";
  if (current > prev * 1.5) return "Failure rate accelerating sharply";
  if (current > prev) return "Failure rate rising";
  if (current < prev) return "Failure pressure easing";
  return "Stable behavior";
}