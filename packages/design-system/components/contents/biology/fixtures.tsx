import { liquidMeniscus } from "@repo/design-system/components/contents/chemistry/glassware";
import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import {
  PrintFace,
  PrintSleeve,
} from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type { ScaleSchema } from "@repo/design-system/components/three/print/scale";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { useMemo } from "react";

/**
 * A laboratory paper label as printed: the title as large as the label
 * allows, a line of detail under it, and a badge on the coloured stripe
 * along its foot.
 */
function labelSheet(
  label: {
    readonly accentColor: string;
    readonly badge: string;
    readonly subtitle: string;
    readonly title: string;
  },
  width: number,
  height: number
): Sheet {
  return {
    ground: BOTANY_COLORS.labelPaper,
    height,
    marks: [
      {
        at: [0, height * -0.345],
        height: height * 0.22,
        ink: label.accentColor,
        kind: "band",
        radius: 0,
        width: width * 0.953,
      },
      {
        at: [0, 0],
        height: height * 0.906,
        ink: BOTANY_COLORS.labelBorder,
        kind: "frame",
        line: height * 0.023,
        radius: 0,
        width: width * 0.953,
      },
      words({
        at: [0, height * 0.2],
        box: {
          height: height * 0.3,
          leading: 1,
          smallest: height * 0.1,
          width: width * 0.86,
        },
        ink: BOTANY_COLORS.labelInk,
        size: height * 0.2,
        text: label.title,
      }),
      words({
        at: [0, height * -0.055],
        box: {
          height: height * 0.16,
          leading: 1,
          smallest: height * 0.06,
          width: width * 0.86,
        },
        face: "mono",
        ink: BOTANY_COLORS.labelInk,
        size: height * 0.11,
        text: label.subtitle,
        weight: 600,
      }),
      words({
        at: [0, height * -0.345],
        box: {
          height: height * 0.18,
          leading: 1,
          smallest: height * 0.06,
          width: width * 0.86,
        },
        ink: getColor("WHITE"),
        size: height * 0.094,
        text: label.badge,
      }),
    ],
    width,
  };
}

/**
 * A printed paper label wrapped round a jar or a bottle: its middle faces
 * the front, at the origin's height.
 *
 * @param arc - How far round the vessel the label wraps, in radians
 * @param height - The label's height, in metres
 * @param radius - The radius of the vessel the label lies on
 */
export function WrappedLabel({
  accentColor,
  arc,
  badge,
  height,
  radius,
  subtitle,
  title,
}: {
  readonly accentColor: string;
  readonly arc: number;
  readonly badge: string;
  readonly height: number;
  readonly radius: number;
  readonly subtitle: string;
  readonly title: string;
}) {
  const sheet = useMemo(
    () =>
      labelSheet({ accentColor, badge, subtitle, title }, radius * arc, height),
    [accentColor, arc, badge, height, radius, subtitle, title]
  );

  return <PrintSleeve radius={radius} sheet={sheet} stock="paper" />;
}

/**
 * The label of a vessel as shares of the vessel: how far round it wraps, in
 * radians, its height, and how far out of the glass it lies.
 */
const LABEL = { arc: Math.PI * 0.9, height: 0.38, reach: 1.015 } as const;

/** Lathed borosilicate glass beaker/jar with concave meniscus and crisp printed label. */
export function LabeledVessel({
  accentColor,
  badge,
  fillFraction = 0.7,
  height = 0.46,
  liquidColor,
  position = [0, 0, 0],
  radius = 0.16,
  subtitle,
  title,
}: {
  readonly accentColor: string;
  readonly badge: string;
  readonly fillFraction?: number;
  readonly height?: number;
  readonly liquidColor: string;
  readonly position?: readonly [number, number, number];
  readonly radius?: number;
  readonly subtitle: string;
  readonly title: string;
}) {
  const glassPoints = [
    [0, 0],
    [radius * 0.94, 0],
    [radius, height * 0.04],
    [radius, height * 0.94],
    [radius * 1.08, height],
  ] as const;
  const liquidLevel = Math.max(height * 0.1, height * fillFraction);
  const liquidPoints = [
    [0.001, height * 0.03],
    [radius * 0.92, height * 0.03],
    ...liquidMeniscus(radius * 0.92, liquidLevel),
    [0.001, liquidLevel],
  ] as const;
  const label = useMemo(
    () =>
      labelSheet(
        { accentColor, badge, subtitle, title },
        radius * LABEL.reach * LABEL.arc,
        height * LABEL.height
      ),
    [accentColor, badge, height, radius, subtitle, title]
  );
  return (
    <group position={position}>
      <mesh>
        <Turn profile={liquidPoints} />
        <LiquidMaterial color={liquidColor} opacity={0.62} />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <Turn profile={glassPoints} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
      <group position={[0, height * 0.46, 0]}>
        <PrintSleeve
          radius={radius * LABEL.reach}
          sheet={label}
          stock="paper"
        />
      </group>
    </group>
  );
}

/** The engraved face of a brass plaque: its width and height, in metres. */
const PLAQUE = { height: 0.12, width: 0.39 } as const;

/**
 * A brass plaque as engraved: the name as large as the plaque allows, a
 * rule under it, and a line of detail below, inside a border.
 */
function plaqueSheet(title: string, subtitle: string): Sheet {
  const { height, width } = PLAQUE;
  return {
    height,
    marks: [
      {
        at: [0, 0],
        height: height * 0.88,
        ink: BOTANY_COLORS.labelInk,
        kind: "frame",
        line: height * 0.02,
        radius: height * 0.04,
        width: width * 0.96,
      },
      words({
        at: [0, height * 0.14],
        box: {
          height: height * 0.4,
          leading: 1,
          smallest: height * 0.14,
          width: width * 0.86,
        },
        ink: BOTANY_COLORS.labelInk,
        size: height * 0.3,
        text: title,
      }),
      {
        from: [width * -0.3, height * -0.1],
        ink: BOTANY_COLORS.labelInk,
        kind: "line",
        to: [width * 0.3, height * -0.1],
        width: height * 0.014,
      },
      words({
        at: [0, height * -0.26],
        box: {
          height: height * 0.2,
          leading: 1,
          smallest: height * 0.08,
          width: width * 0.86,
        },
        ink: BOTANY_COLORS.labelInk,
        size: height * 0.15,
        text: subtitle,
        weight: 600,
      }),
    ],
    width,
  };
}

/** Engraved antique brass nameplate plaque for museum/botanical specimens. */
export function BrassPlaque({
  highlight = false,
  position = [0, 0, 0],
  rotation = [-0.42, 0, 0],
  subtitle,
  title,
}: {
  readonly highlight?: boolean;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly subtitle: string;
  readonly title: string;
}) {
  const sheet = useMemo(() => plaqueSheet(title, subtitle), [subtitle, title]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.14, 0.018]} />
        <MetalMaterial
          color={
            highlight ? BOTANY_COLORS.brassHighlight : BOTANY_COLORS.brassGold
          }
          roughness={0.32}
        />
        <group position={[0, 0, 0.0092]}>
          <PrintFace sheet={sheet} stock="engraving" />
        </group>
      </mesh>
    </group>
  );
}

/**
 * Graduated boxwood scale ruler: its scale is engraved along its whole
 * length, so its far end reads the scale's last value.
 *
 * @param scale - What the ruler reads from its foot to its far end
 * @param turn - How far its numbers are turned, so they read upright from where the ruler is seen
 */
export function GraduatedRuler({
  height = 1.2,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale,
  turn,
  width = 0.085,
}: {
  readonly height?: number;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale: typeof ScaleSchema.Type;
  readonly turn: number;
  readonly width?: number;
}) {
  const format = usePrintNumber();
  const sheet = useMemo((): Sheet => {
    const margin = height * 0.025;
    return {
      height,
      marks: ruleMarks(
        {
          from: [-width / 2, -height / 2 + margin],
          scale,
          side: -1,
          to: [-width / 2, height / 2 - margin],
        },
        format,
        {
          ink: BOTANY_COLORS.labelInk,
          major: width * 0.42,
          minor: width * 0.22,
          size: width * 0.2,
          turn,
          width: width * 0.02,
        }
      ),
      width,
    };
  }, [format, height, scale, turn, width]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.016]} />
        <meshStandardMaterial color={BOTANY_COLORS.woodRule} roughness={0.68} />
        <group position={[0, 0, 0.0082]}>
          <PrintFace sheet={sheet} stock="engraving" />
        </group>
      </mesh>
    </group>
  );
}
