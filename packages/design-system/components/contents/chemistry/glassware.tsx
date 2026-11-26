import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  DoubleSide,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from "three";

const MENISCUS_RISE = 0.0015;
const MENISCUS_REACH = 0.004;

/** An outline turned around a vertical axis, from its radii at each height. */
export function latheProfile(points: readonly (readonly [number, number])[]) {
  return Arr.map(points, ([radius, height]) => new Vector2(radius, height));
}

/**
 * The surface of a liquid in glass, as lathe points from the wall inward:
 * water wets glass, so its surface climbs the wall in a concave meniscus and
 * lies flat in the middle, where a reading is taken.
 */
export function liquidMeniscus(radius: number, level: number) {
  const reach = Math.min(MENISCUS_REACH, radius * 0.6);
  return Arr.map(Arr.range(0, 6), (step) => {
    const share = step / 6;
    return [
      radius - share * reach,
      level + MENISCUS_RISE * (1 - share) ** 2,
    ] as const;
  });
}

/** Procedural matte-satin phenolic epoxy tabletop grain texture. */
export function createEpoxyTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = BENCH_COLORS.epoxyBase;
  ctx.fillRect(0, 0, 256, 256);
  const specks = [
    BENCH_COLORS.epoxy,
    BENCH_COLORS.epoxyDrip,
    BENCH_COLORS.balanceWell,
  ] as const;
  for (let i = 0; i < 2200; i += 1) {
    const x = (i * 73 + 17) % 256;
    const y = (i * 139 + 41) % 256;
    ctx.fillStyle = specks[i % specks.length] ?? BENCH_COLORS.epoxy;
    ctx.fillRect(x, y, 2, 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 3);
  texture.needsUpdate = true;
  return texture;
}

/** Printed paper reagent bottle label with formula, concentration, and GHS stripe. */
function createBottleLabelTexture(
  formula: string,
  concentration: string,
  stripe: string
): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = BENCH_COLORS.bottleLabelPaper;
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = BENCH_COLORS.bottleLabelRule;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 144);
  ctx.fillStyle = stripe;
  ctx.fillRect(8, 126, 240, 26);
  ctx.fillStyle = BENCH_COLORS.bottleLabelInk;
  ctx.font = `700 ${formula.length > 5 ? 28 : 38}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(formula, 128, 66);
  ctx.fillStyle = BENCH_COLORS.bottleLabelSub;
  ctx.font = "600 22px ui-monospace, monospace";
  ctx.fillText(concentration, 128, 102);
  ctx.fillStyle = getColor("WHITE");
  ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("REAGENT GRADE", 128, 144);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Silk-screened white enamel volumetric graduations for a 100 mL borosilicate beaker. */
export function createBeakerMarkingsTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, 512, 256);
  ctx.shadowColor = BENCH_COLORS.glassMarkingShadow;
  ctx.shadowBlur = 2;
  ctx.strokeStyle = BENCH_COLORS.glassMarking;
  ctx.fillStyle = BENCH_COLORS.glassMarking;
  ctx.lineWidth = 4;
  ctx.font = "700 20px ui-sans-serif, system-ui, sans-serif";
  const ticks = [
    { label: "100", y: 52 },
    { label: "75", y: 98 },
    { label: "50", y: 144 },
    { label: "25", y: 190 },
  ] as const;
  Arr.forEach(ticks, (tick) => {
    ctx.beginPath();
    ctx.moveTo(212, tick.y);
    ctx.lineTo(268, tick.y);
    ctx.stroke();
    ctx.fillText(tick.label, 276, tick.y + 7);
  });
  ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("100 mL", 212, 28);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Silk-screened white enamel volumetric graduations for a 250 mL Erlenmeyer flask. */
export function createFlaskMarkingsTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, 512, 256);
  ctx.shadowColor = BENCH_COLORS.glassMarkingShadow;
  ctx.shadowBlur = 2;
  ctx.strokeStyle = BENCH_COLORS.glassMarking;
  ctx.fillStyle = BENCH_COLORS.glassMarking;
  ctx.lineWidth = 4;
  ctx.font = "700 20px ui-sans-serif, system-ui, sans-serif";
  const ticks = [
    { label: "200", y: 74 },
    { label: "150", y: 118 },
    { label: "100", y: 162 },
    { label: "50", y: 206 },
  ] as const;
  Arr.forEach(ticks, (tick) => {
    ctx.beginPath();
    ctx.moveTo(220, tick.y);
    ctx.lineTo(268, tick.y);
    ctx.stroke();
    ctx.fillText(tick.label, 276, tick.y + 7);
  });
  ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("250 mL", 220, 44);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const BOTTLE_PROFILE = latheProfile([
  [0.001, 0],
  [0.043, 0],
  [0.047, 0.006],
  [0.047, 0.106],
  [0.039, 0.128],
  [0.02, 0.144],
  [0.018, 0.154],
  [0.021, 0.157],
]);

const CAP_RIBS = Arr.range(0, 11);

const SHELF_BOTTLES = [
  {
    concentration: "0.1 M",
    fillHeight: 0.088,
    formula: "AgNO3",
    glassColor: BENCH_COLORS.bottleAmber,
    glassOpacity: 0.54,
    liquidColor: REAGENT_COLORS.solution,
    stripeColor: BENCH_COLORS.bottleStripeAmber,
  },
  {
    concentration: "1.0 M",
    fillHeight: 0.094,
    formula: "NaCl",
    glassColor: BENCH_COLORS.bottleClear,
    glassOpacity: 0.24,
    liquidColor: REAGENT_COLORS.solution,
    stripeColor: BENCH_COLORS.bottleStripeSalt,
  },
  {
    concentration: "0.5 M",
    fillHeight: 0.076,
    formula: "HCl",
    glassColor: BENCH_COLORS.bottleGreen,
    glassOpacity: 0.48,
    liquidColor: REAGENT_COLORS.ironPaleGreen,
    stripeColor: BENCH_COLORS.bottleStripeAcid,
  },
  {
    concentration: "0.2 M",
    fillHeight: 0.082,
    formula: "CuSO4",
    glassColor: BENCH_COLORS.bottleClear,
    glassOpacity: 0.24,
    liquidColor: REAGENT_COLORS.copperSulfate,
    stripeColor: BENCH_COLORS.bottleStripeBlue,
  },
  {
    concentration: "1.0 M",
    fillHeight: 0.072,
    formula: "CH3COOH",
    glassColor: BENCH_COLORS.bottleAmber,
    glassOpacity: 0.54,
    liquidColor: REAGENT_COLORS.vinegar,
    stripeColor: BENCH_COLORS.bottleStripeVinegar,
  },
  {
    concentration: "0.5 M",
    fillHeight: 0.09,
    formula: "NaOH",
    glassColor: BENCH_COLORS.bottleGreen,
    glassOpacity: 0.48,
    liquidColor: REAGENT_COLORS.solution,
    stripeColor: BENCH_COLORS.bottleStripeBase,
  },
] as const;

/** A single translucent borosilicate reagent bottle with meniscus, label, and GL45 cap. */
function ReagentBottle({
  concentration,
  fillHeight,
  formula,
  glassColor,
  glassOpacity,
  liquidColor,
  position,
  stripeColor,
}: {
  readonly concentration: string;
  readonly fillHeight: number;
  readonly formula: string;
  readonly glassColor: string;
  readonly glassOpacity: number;
  readonly liquidColor: string;
  readonly position: readonly [number, number, number];
  readonly stripeColor: string;
}) {
  const labelTex = useMemo(
    () => createBottleLabelTexture(formula, concentration, stripeColor),
    [concentration, formula, stripeColor]
  );
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  const liquidPoints = useMemo(
    () =>
      latheProfile([
        [0.0005, 0.005],
        [0.0435, 0.005],
        ...liquidMeniscus(0.0435, fillHeight),
        [0.0005, fillHeight],
      ]),
    [fillHeight]
  );

  return (
    <group position={position}>
      <mesh>
        <latheGeometry args={[liquidPoints, 48]} />
        <LiquidMaterial color={liquidColor} opacity={0.72} />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[BOTTLE_PROFILE, 36]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={glassColor}
          depthWrite={false}
          ior={1.5}
          metalness={0}
          opacity={glassOpacity}
          roughness={0.06}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.003, 0]}>
        <cylinderGeometry args={[0.044, 0.043, 0.006, 32]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={glassColor}
          opacity={Math.min(0.68, glassOpacity + 0.18)}
          roughness={0.08}
          transparent
        />
      </mesh>
      {labelTex === null ? null : (
        <mesh position={[0, 0.056, 0]} rotation={[0, -Math.PI * 0.44, 0]}>
          <cylinderGeometry
            args={[0.0478, 0.0478, 0.056, 24, 1, true, 0, Math.PI * 0.88]}
          />
          <meshStandardMaterial
            map={labelTex}
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.86}
          />
        </mesh>
      )}
      <group position={[0, 0.162, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.021, 0.021, 0.024, 24]} />
          <meshStandardMaterial
            color={BENCH_COLORS.bottleCap}
            roughness={0.56}
          />
        </mesh>
        <mesh position={[0, -0.014, 0]}>
          <cylinderGeometry args={[0.0225, 0.0225, 0.005, 24]} />
          <meshStandardMaterial
            color={BENCH_COLORS.bottleCap}
            roughness={0.62}
          />
        </mesh>
        {Arr.map(CAP_RIBS, (idx) => {
          const angle = (idx / CAP_RIBS.length) * Math.PI * 2;
          return (
            <mesh
              key={idx}
              position={[Math.cos(angle) * 0.0212, 0, Math.sin(angle) * 0.0212]}
            >
              <cylinderGeometry args={[0.001, 0.001, 0.021, 6]} />
              <meshStandardMaterial
                color={BENCH_COLORS.bottleCapRib}
                roughness={0.65}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Row of six labeled borosilicate reagent bottles standing along the bench rear. */
export function ReagentShelf({ width }: { readonly width: number }) {
  const bottles = Arr.map(SHELF_BOTTLES, (spec, index) => ({
    ...spec,
    key: spec.formula,
    x: -width / 2 + 0.26 + index * 0.175,
  }));

  return (
    <group>
      {Arr.map(bottles, (bottle) => (
        <ReagentBottle
          concentration={bottle.concentration}
          fillHeight={bottle.fillHeight}
          formula={bottle.formula}
          glassColor={bottle.glassColor}
          glassOpacity={bottle.glassOpacity}
          key={bottle.key}
          liquidColor={bottle.liquidColor}
          position={[bottle.x, 0, -0.335]}
          stripeColor={bottle.stripeColor}
        />
      ))}
    </group>
  );
}
