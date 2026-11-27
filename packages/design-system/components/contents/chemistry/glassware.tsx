import { parseFormulaRuns } from "@repo/design-system/components/contents/chemistry/formula";
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

const MENISCUS_RISE = 0.0018;
const MENISCUS_REACH = 0.0046;
const FORMULA_FONT_FAMILY =
  "ui-sans-serif, system-ui, -apple-system, sans-serif";

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

/**
 * Draws a Unicode chemical formula or unit (e.g. `AgNO₃`, `CuSO₄`, `dm³`)
 * onto a 2D canvas with crisp baseline-shifted subscripts and superscripts.
 */
function drawFormulaText(
  ctx: CanvasRenderingContext2D,
  formula: string,
  anchorX: number,
  baselineY: number,
  fontSize: number,
  align: "center" | "left" = "center"
) {
  const runs = parseFormulaRuns(formula);
  const subSize = Math.round(fontSize * 0.68);
  const measured = Arr.map(runs, (run) => {
    const size = run.kind === "normal" ? fontSize : subSize;
    ctx.font = `700 ${size}px ${FORMULA_FONT_FAMILY}`;
    return {
      ...run,
      size,
      width: ctx.measureText(run.text).width,
    };
  });
  const totalWidth = Arr.reduce(measured, 0, (sum, item) => sum + item.width);
  let cursorX = align === "center" ? anchorX - totalWidth / 2 : anchorX;
  const previousAlign = ctx.textAlign;
  ctx.textAlign = "left";
  Arr.forEach(measured, (item) => {
    ctx.font = `700 ${item.size}px ${FORMULA_FONT_FAMILY}`;
    let dy = 0;
    if (item.kind === "sub") {
      dy = Math.round(fontSize * 0.22);
    } else if (item.kind === "sup") {
      dy = -Math.round(fontSize * 0.34);
    }
    ctx.fillText(item.text, cursorX, baselineY + dy);
    cursorX += item.width;
  });
  ctx.textAlign = previousAlign;
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

/**
 * A printed paper reagent bottle label, drawn large enough to read from
 * across the bench: the formula with true subscripts fills the label, the
 * chemical's name sits under it, and the hazard stripe carries the
 * concentration.
 */
function createBottleLabelTexture(
  formula: string,
  chemicalName: string,
  concentration: string,
  stripe: string
): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = BENCH_COLORS.bottleLabelPaper;
  ctx.fillRect(0, 0, 1024, 768);

  ctx.strokeStyle = BENCH_COLORS.bottleLabelRule;
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, 976, 720);

  ctx.fillStyle = stripe;
  ctx.fillRect(24, 588, 976, 156);

  ctx.fillStyle = BENCH_COLORS.bottleLabelInk;
  const formulaSize = formula.length > 6 ? 170 : 250;
  drawFormulaText(ctx, formula, 512, 330, formulaSize, "center");

  ctx.fillStyle = BENCH_COLORS.bottleLabelSub;
  ctx.textAlign = "center";
  ctx.font = `600 76px ${FORMULA_FONT_FAMILY}`;
  ctx.fillText(chemicalName, 512, 500);

  ctx.fillStyle = getColor("WHITE");
  ctx.font = `700 104px ${FORMULA_FONT_FAMILY}`;
  ctx.fillText(concentration, 512, 704);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 16;
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
  ctx.font = `700 20px ${FORMULA_FONT_FAMILY}`;
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
  ctx.font = `700 16px ${FORMULA_FONT_FAMILY}`;
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
  ctx.font = `700 20px ${FORMULA_FONT_FAMILY}`;
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
  ctx.font = `700 16px ${FORMULA_FONT_FAMILY}`;
  ctx.fillText("250 mL", 220, 44);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const BOTTLE_PROFILE = latheProfile([
  [0.001, 0],
  [0.042, 0],
  [0.0455, 0.003],
  [0.047, 0.009],
  [0.047, 0.102],
  [0.0452, 0.114],
  [0.04, 0.126],
  [0.031, 0.136],
  [0.0215, 0.143],
  [0.0185, 0.149],
  [0.0185, 0.155],
  [0.0215, 0.158],
]);

const CAP_RIBS = Arr.range(0, 11);

const SHELF_BOTTLES = [
  {
    chemicalName: "Silver Nitrate",
    concentration: "0.1 M",
    fillHeight: 0.088,
    formula: "AgNO₃",
    glassColor: BENCH_COLORS.bottleAmber,
    glassOpacity: 0.56,
    liquidColor: REAGENT_COLORS.solution,
    stripeColor: BENCH_COLORS.bottleStripeAmber,
  },
  {
    chemicalName: "Sodium Chloride",
    concentration: "1.0 M",
    fillHeight: 0.094,
    formula: "NaCl",
    glassColor: BENCH_COLORS.bottleClear,
    glassOpacity: 0.25,
    liquidColor: REAGENT_COLORS.solution,
    stripeColor: BENCH_COLORS.bottleStripeSalt,
  },
  {
    chemicalName: "Hydrochloric Acid",
    concentration: "0.5 M",
    fillHeight: 0.076,
    formula: "HCl",
    glassColor: BENCH_COLORS.bottleGreen,
    glassOpacity: 0.48,
    liquidColor: REAGENT_COLORS.ironPaleGreen,
    stripeColor: BENCH_COLORS.bottleStripeAcid,
  },
  {
    chemicalName: "Copper(II) Sulfate",
    concentration: "0.2 M",
    fillHeight: 0.082,
    formula: "CuSO₄",
    glassColor: BENCH_COLORS.bottleClear,
    glassOpacity: 0.25,
    liquidColor: REAGENT_COLORS.copperSulfate,
    stripeColor: BENCH_COLORS.bottleStripeBlue,
  },
  {
    chemicalName: "Ethanoic Acid",
    concentration: "1.0 M",
    fillHeight: 0.072,
    formula: "CH₃COOH",
    glassColor: BENCH_COLORS.bottleAmber,
    glassOpacity: 0.56,
    liquidColor: REAGENT_COLORS.vinegar,
    stripeColor: BENCH_COLORS.bottleStripeVinegar,
  },
  {
    chemicalName: "Sodium Hydroxide",
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
  chemicalName,
  concentration,
  fillHeight,
  formula,
  glassColor,
  glassOpacity,
  liquidColor,
  position,
  stripeColor,
}: {
  readonly chemicalName: string;
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
    () =>
      createBottleLabelTexture(
        formula,
        chemicalName,
        concentration,
        stripeColor
      ),
    [chemicalName, concentration, formula, stripeColor]
  );
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  const liquidPoints = useMemo(
    () =>
      latheProfile([
        [0.0005, 0.006],
        [0.0435, 0.006],
        ...liquidMeniscus(0.0435, fillHeight),
        [0.0005, fillHeight],
      ]),
    [fillHeight]
  );

  return (
    <group position={position}>
      <mesh>
        <latheGeometry args={[liquidPoints, 48]} />
        <LiquidMaterial color={liquidColor} opacity={0.76} />
      </mesh>
      <mesh
        position={[0, fillHeight + MENISCUS_RISE, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.0432, 0.0008, 10, 48]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={BENCH_COLORS.streamGlint}
          depthWrite={false}
          opacity={0.48}
          roughness={0.08}
          transparent
        />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[BOTTLE_PROFILE, 48]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.03}
          color={glassColor}
          depthWrite={false}
          ior={1.473}
          metalness={0}
          opacity={glassOpacity}
          roughness={0.05}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.004, 0]}>
        <cylinderGeometry args={[0.0442, 0.0428, 0.008, 36]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={glassColor}
          ior={1.473}
          opacity={Math.min(0.72, glassOpacity + 0.2)}
          roughness={0.07}
          transparent
        />
      </mesh>
      {labelTex === null ? null : (
        <mesh position={[0, 0.058, 0]} rotation={[0, -Math.PI * 0.44, 0]}>
          <cylinderGeometry
            args={[0.0478, 0.0478, 0.078, 48, 1, true, 0, Math.PI * 0.88]}
          />
          <meshStandardMaterial
            map={labelTex}
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.86}
          />
        </mesh>
      )}
      <group position={[0, 0.163, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.021, 0.021, 0.024, 24]} />
          <meshStandardMaterial
            color={BENCH_COLORS.bottleCap}
            roughness={0.56}
          />
        </mesh>
        <mesh position={[0, -0.014, 0]}>
          <cylinderGeometry args={[0.0226, 0.0226, 0.005, 24]} />
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
          chemicalName={bottle.chemicalName}
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
