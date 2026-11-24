import { Schema } from "effect";

/** Adaptive quality levels stepped down only when sustained frames miss 60 fps. */
const QualityLevelSchema = Schema.Literals(["full", "direct", "reduced"]);
type QualityLevel = typeof QualityLevelSchema.Type;

/** Configuration for an adaptive frame-time monitor on one WebGL canvas. */
const MonitorConfigSchema = Schema.Struct({
  /** Whether stepping down DPR is allowed (disabled on software rasterizers and 1x displays). */
  canReduceDpr: Schema.Boolean,
  /** Whether the scene currently renders heavy postprocessing that can be dropped first. */
  hasPostprocessing: Schema.Boolean,
});
type MonitorConfig = typeof MonitorConfigSchema.Type;

/** Smoothing factor for the exponential moving average of active frame times. */
const EMA_ALPHA = 0.15;

/** Frame times above this threshold (50 fps) count toward a quality step-down. */
const SLOW_FRAME_MS = 20;

/** Frame times at or below 60 fps clear the consecutive slow-frame counter. */
const HEALTHY_FRAME_MS = 16.7;

/** Gaps longer than this come from idle pauses or tab switches, not slow GPU frames. */
const MAX_SAMPLE_MS = 120;

/** Consecutive slow frames before disabling postprocessing. */
const POSTPROCESSING_DROP_FRAMES = 10;

/** Consecutive slow frames before stepping down DPR to 1x. */
const DPR_DROP_FRAMES = 18;

/** Cooldown frames after a step-down so the GPU pipeline settles before re-evaluating. */
const COOLDOWN_FRAMES = 15;

/**
 * Tracks a rolling exponential moving average of active GPU frame times and
 * steps quality down when sustained frames miss 60 fps: first disabling
 * multi-pass postprocessing (`"direct"`), then reducing DPR to 1x (`"reduced"`).
 *
 * Fast GPUs (60 to 120+ fps) remain at `"full"` with zero allocations per frame.
 */
export function createPerformanceMonitor(config: MonitorConfig) {
  let level: QualityLevel = config.hasPostprocessing ? "full" : "direct";
  let emaMs = 0;
  let slowFrames = 0;
  let cooldown = 0;

  /** Records one active frame duration in milliseconds and returns the current quality level. */
  const record = (deltaMs: number): QualityLevel => {
    if (
      !Number.isFinite(deltaMs) ||
      deltaMs <= 0 ||
      deltaMs > MAX_SAMPLE_MS ||
      level === "reduced"
    ) {
      return level;
    }

    emaMs = emaMs === 0 ? deltaMs : emaMs + (deltaMs - emaMs) * EMA_ALPHA;

    if (cooldown > 0) {
      cooldown -= 1;
      return level;
    }

    if (emaMs > SLOW_FRAME_MS && deltaMs > SLOW_FRAME_MS) {
      slowFrames += 1;
      if (level === "full" && slowFrames >= POSTPROCESSING_DROP_FRAMES) {
        level = "direct";
        slowFrames = 0;
        cooldown = COOLDOWN_FRAMES;
        return level;
      }
      if (
        level === "direct" &&
        config.canReduceDpr &&
        slowFrames >= DPR_DROP_FRAMES
      ) {
        level = "reduced";
        slowFrames = 0;
        return level;
      }
      return level;
    }

    if (emaMs <= HEALTHY_FRAME_MS) {
      slowFrames = 0;
    }

    return level;
  };

  /** Current adaptive quality level. */
  const current = (): QualityLevel => level;

  return { current, record };
}
