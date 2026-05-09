type PerfValue = string | number | boolean | null | undefined;

export function nowMs() {
  return Date.now();
}

export function durationMs(startMs: number) {
  return Date.now() - startMs;
}

export function logPerf(
  label: string,
  values: Record<string, PerfValue>
) {
  const fields = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`);

  if (fields.length === 0) {
    console.info(`[perf] ${label}`);
    return;
  }

  console.info(`[perf] ${label} ${fields.join(" ")}`);
}
