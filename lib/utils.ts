export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatTrendScore(value: number) {
  return value.toFixed(1);
}

export function titleCase(value: string) {
  return value
    .split(/[\s/-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toHourBucket(input: Date | string) {
  const date = new Date(input);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function id(_prefix: string) {
  return crypto.randomUUID();
}
