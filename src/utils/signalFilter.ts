export function shouldEmitSignal(
  failureRate: number,
  trend: string
): boolean {
  // Ignore boring blocks
  if (failureRate === 0 && trend === "Stable behavior") return false;

  // Ignore very tiny noise
  if (failureRate < 0.03) return false;

  return true;
}