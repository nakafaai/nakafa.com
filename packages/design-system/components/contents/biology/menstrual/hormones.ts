import { Array as Arr, Schema } from "effect";

const OUTCOMES = ["cycle", "pregnancy", "miscarriage"] as const;
const HORMONES = ["fsh", "lh", "oestrogen", "progesterone", "hcg"] as const;
const PHASES = [
  "menstruation",
  "follicle",
  "ovulation",
  "luteal",
  "pregnancy",
  "miscarriage",
] as const;

const OutcomeSchema = Schema.Literals(OUTCOMES);
const HormoneSchema = Schema.Literals(HORMONES);
const PhaseSchema = Schema.Literals(PHASES);

export type Outcome = typeof OutcomeSchema.Type;
export type Hormone = typeof HormoneSchema.Type;
export type Phase = typeof PhaseSchema.Type;

const CycleSnapshotSchema = Schema.Struct({
  fsh: Schema.Finite,
  hcg: Schema.Finite,
  lh: Schema.Finite,
  lining: Schema.Finite,
  oestrogen: Schema.Finite,
  phase: PhaseSchema,
  progesterone: Schema.Finite,
});

type CycleSnapshot = typeof CycleSnapshotSchema.Type;

/** Day of ovulation: fixed `luteal` days before the end of the cycle. */
export function ovulationDay(cycleLength: number, luteal: number): number {
  return Math.max(1, cycleLength - luteal);
}

/** Gaussian pulse helper for smooth hormone peaks. */
function bell(x: number, center: number, width: number): number {
  const z = (x - center) / width;
  return Math.exp(-0.5 * z * z);
}

/** Active menstrual cycle phase at `day` (1-indexed). */
export function phaseAt(
  day: number,
  cycleLength: number,
  luteal: number,
  outcome: Outcome
): Phase {
  const ov = ovulationDay(cycleLength, luteal);
  if (day <= 5) {
    return "menstruation";
  }
  if (day < ov - 1) {
    return "follicle";
  }
  if (day <= ov + 1) {
    return "ovulation";
  }
  if (day >= ov + 7 && outcome === "pregnancy") {
    return "pregnancy";
  }
  if (day >= ov + 9 && outcome === "miscarriage") {
    return "miscarriage";
  }
  return "luteal";
}

/** Normalized hormone curves (0..1) and endometrium lining thickness (0.15..1). */
export function snapshotAt(
  day: number,
  cycleLength: number,
  luteal: number,
  outcome: Outcome
): CycleSnapshot {
  const ov = ovulationDay(cycleLength, luteal);
  const fsh = 0.22 + 0.36 * bell(day, 4, 3.2) + 0.42 * bell(day, ov, 1.3);
  const lh = 0.14 + 0.86 * bell(day, ov, 0.9);
  const oestrogen =
    0.16 +
    0.72 * bell(day, ov - 1.5, 2.4) +
    0.38 * bell(day, ov + luteal * 0.5, 4);

  let progesterone = 0.1 + 0.8 * bell(day, ov + luteal * 0.5, 4.2);
  let hcg = 0;

  if (day > ov + 6 && outcome === "pregnancy") {
    const rise = Math.min(1, (day - (ov + 6)) / 5);
    hcg = rise * 0.9;
    progesterone = Math.max(progesterone, 0.82);
  } else if (day > ov + 8 && outcome === "miscarriage") {
    const drop = Math.min(1, (day - (ov + 8)) / 3);
    progesterone = Math.max(0.08, progesterone * (1 - drop * 0.85));
  }

  let lining = 0.2;
  if (day <= 5) {
    lining = 0.65 - (day / 5) * 0.45;
  } else if (day <= ov + 7) {
    lining = 0.2 + ((day - 5) / Math.max(1, ov + 2)) * 0.72;
  } else if (outcome === "pregnancy") {
    lining = 0.95;
  } else if (outcome === "miscarriage" && day >= ov + 9) {
    lining = 0.28;
  } else {
    const tail = (day - (ov + 7)) / Math.max(1, cycleLength - (ov + 7));
    lining = 0.92 - tail * 0.35;
  }

  return {
    fsh: Math.min(1, fsh),
    hcg,
    lh: Math.min(1, lh),
    lining: Math.max(0.15, Math.min(1, lining)),
    oestrogen: Math.min(1, oestrogen),
    phase: phaseAt(day, cycleLength, luteal, outcome),
    progesterone: Math.min(1, progesterone),
  };
}

/** 3D chart curve points for one hormone over days 1..cycleLength. */
export function curvePoints(
  hormone: Hormone,
  cycleLength: number,
  luteal: number,
  outcome: Outcome
): readonly (readonly [number, number, number])[] {
  return Arr.makeBy(cycleLength, (index) => {
    const day = index + 1;
    const snap = snapshotAt(day, cycleLength, luteal, outcome);
    const x = -0.85 + (index / Math.max(1, cycleLength - 1)) * 1.7;
    const y = 0.52 + snap[hormone] * 0.56;
    return [x, y, -0.22] as const;
  });
}
