import { Array as Arr, Schema } from "effect";

export const STAGES = [
  "zygote",
  "twoCell",
  "morula",
  "blastocyst",
  "implanting",
] as const;

export const StageSchema = Schema.Literals(STAGES);
export type Stage = typeof StageSchema.Type;

export const MAX_DAY = 9;

const EmbryoStateSchema = Schema.Struct({
  cells: Schema.Finite,
  hcg: Schema.Boolean,
  position: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  share: Schema.String,
  stage: StageSchema,
});

type EmbryoState = typeof EmbryoStateSchema.Type;

const BlastomereSchema = Schema.Struct({
  id: Schema.String,
  inner: Schema.Boolean,
  offset: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  radius: Schema.Finite,
});

type Blastomere = typeof BlastomereSchema.Type;

/** Clamp post-fertilisation day into [0, 9]. */
export function clampDay(day: number): number {
  return Math.max(0, Math.min(MAX_DAY, Math.round(day)));
}

/**
 * Embryo stage, cell count, per-cell share of the original zygote cytoplasm,
 * HCG release flag, and 3D position travelling from ampulla to endometrium.
 */
export function embryoAt(day: number): EmbryoState {
  const safe = clampDay(day);
  const t = safe / MAX_DAY;
  const x = -0.75 + t * 1.48;
  const y =
    safe >= 7 ? 0.42 - (safe - 7) * 0.08 : 0.72 - Math.sin(t * Math.PI) * 0.14;
  const position = [x, y, 0.08] as const;

  if (safe === 0) {
    return { cells: 1, hcg: false, position, share: "1 / 1", stage: "zygote" };
  }
  if (safe <= 2) {
    const cells = safe === 1 ? 2 : 4;
    return {
      cells,
      hcg: false,
      position,
      share: `1 / ${cells}`,
      stage: "twoCell",
    };
  }
  if (safe <= 4) {
    const cells = safe === 3 ? 16 : 32;
    return {
      cells,
      hcg: false,
      position,
      share: `1 / ${cells}`,
      stage: "morula",
    };
  }
  if (safe <= 6) {
    return {
      cells: 64,
      hcg: false,
      position,
      share: "1 / 64",
      stage: "blastocyst",
    };
  }
  return {
    cells: 100,
    hcg: true,
    position,
    share: "1 / 100",
    stage: "implanting",
  };
}

/** Packed blastomere sphere offsets inside the constant-radius zona pellucida. */
export function blastomeres(stage: Stage): readonly Blastomere[] {
  if (stage === "zygote") {
    return [{ id: "zygote-0", inner: true, offset: [0, 0, 0], radius: 0.12 }];
  }
  if (stage === "twoCell") {
    return [
      { id: "two-0", inner: true, offset: [-0.055, 0, 0], radius: 0.078 },
      { id: "two-1", inner: true, offset: [0.055, 0, 0], radius: 0.078 },
    ];
  }
  if (stage === "morula") {
    return Arr.makeBy(10, (index) => {
      const angle = (index / 10) * Math.PI * 2;
      const ring = index < 8 ? 0.075 : 0.025;
      return {
        id: `morula-${index}`,
        inner: true,
        offset: [
          Math.cos(angle) * ring,
          Math.sin(angle) * ring,
          (index % 2 === 0 ? 1 : -1) * 0.03,
        ] as const,
        radius: 0.044,
      };
    });
  }
  const ring = Arr.makeBy(12, (index) => {
    const angle = (index / 12) * Math.PI * 2;
    return {
      id: `troph-${index}`,
      inner: false,
      offset: [Math.cos(angle) * 0.11, Math.sin(angle) * 0.11, 0] as const,
      radius: 0.03,
    };
  });
  const icm = Arr.makeBy(4, (index) => ({
    id: `icm-${index}`,
    inner: true,
    offset: [
      -0.04 + (index % 2) * 0.045,
      0.035 + Math.floor(index / 2) * 0.03,
      0.01,
    ] as const,
    radius: 0.034,
  }));
  return Arr.appendAll(ring, icm);
}
