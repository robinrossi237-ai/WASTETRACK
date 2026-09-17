export type EtaBaseline = {
  baseSeconds: number;
  startedAt: number;
};

type BuildEtaBaselineParams = {
  incomingSeconds: number;
  previous: EtaBaseline | null;
  now?: number;
  reset?: boolean;
  maxIncreaseSeconds?: number;
  keepRatio?: number;
};

const DEFAULT_MAX_INCREASE_SECONDS = 120;
const DEFAULT_KEEP_RATIO = 0.6;

export const getRemainingEtaSeconds = (baseline: EtaBaseline, now = Date.now()) => {
  const elapsedSeconds = Math.floor((now - baseline.startedAt) / 1000);
  return Math.max(0, baseline.baseSeconds - elapsedSeconds);
};

export const buildEtaBaseline = ({
  incomingSeconds,
  previous,
  now = Date.now(),
  reset = false,
  maxIncreaseSeconds = DEFAULT_MAX_INCREASE_SECONDS,
  keepRatio = DEFAULT_KEEP_RATIO,
}: BuildEtaBaselineParams): EtaBaseline => {
  const incoming = Math.max(0, Math.round(incomingSeconds));

  if (reset || !previous) {
    return { baseSeconds: incoming, startedAt: now };
  }

  const remaining = getRemainingEtaSeconds(previous, now);
  if (remaining <= 0) {
    return { baseSeconds: incoming, startedAt: now };
  }

  const boundedIncoming = Math.min(incoming, remaining + Math.max(0, maxIncreaseSeconds));
  const boundedKeepRatio = Math.min(0.95, Math.max(0.05, keepRatio));
  const blended = Math.round(remaining * boundedKeepRatio + boundedIncoming * (1 - boundedKeepRatio));

  return { baseSeconds: Math.max(0, blended), startedAt: now };
};

export const formatEtaCountdown = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};
