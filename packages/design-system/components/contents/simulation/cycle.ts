import { Schema } from "effect";

/** Bounded looping progress in `[0, total]` with an explicit end-of-cycle hold timer. */
const CycleStateSchema = Schema.Struct({
  /** Seconds already spent resting at `total` before looping back to zero. */
  hold: Schema.Finite,
  /** Current value strictly clamped to `[0, total]`. */
  value: Schema.Finite,
});

export type CycleState = typeof CycleStateSchema.Type;

/**
 * Advances a bounded looping cycle by `deltaSeconds` at `rate` units per
 * second. The value never overshoots `total`: once it reaches `total`, it
 * holds at `total` for `holdSeconds` and then restarts cleanly from `0`.
 */
export function stepCycle(
  current: CycleState,
  options: {
    readonly deltaSeconds: number;
    readonly holdSeconds: number;
    readonly rate: number;
    readonly total: number;
  }
): CycleState {
  const { deltaSeconds, holdSeconds, rate, total } = options;
  if (deltaSeconds <= 0 || total <= 0 || rate <= 0) {
    return {
      hold: Math.max(0, current.hold),
      value: Math.min(total, Math.max(0, current.value)),
    };
  }
  if (current.value >= total) {
    const nextHold = current.hold + deltaSeconds;
    if (nextHold >= holdSeconds) {
      return { hold: 0, value: 0 };
    }
    return { hold: nextHold, value: total };
  }
  const advanced = current.value + deltaSeconds * rate;
  if (advanced >= total) {
    return { hold: 0, value: total };
  }
  return { hold: 0, value: Math.max(0, advanced) };
}

/** Quantizes a cycle value onto `steps` evenly spaced slider ticks inside `[0, total]`. */
export function quantizeCycle(
  value: number,
  total: number,
  steps: number
): number {
  const clamped = Math.min(total, Math.max(0, value));
  if (steps <= 0 || total <= 0) {
    return clamped;
  }
  const unit = total / steps;
  return Math.min(total, Math.round(clamped / unit) * unit);
}
