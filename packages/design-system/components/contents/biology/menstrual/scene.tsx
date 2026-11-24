import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Hormone,
  Outcome,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";
import {
  curvePoints,
  ovulationDay,
  snapshotAt,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.88, 2.35];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

const HORMONE_SERIES: readonly (readonly [Hormone, string])[] = [
  ["fsh", PLOT_COLORS.violet],
  ["lh", PLOT_COLORS.pink],
  ["oestrogen", PLOT_COLORS.teal],
  ["progesterone", PLOT_COLORS.amber],
  ["hcg", PLOT_COLORS.orange],
];

/**
 * 3D menstrual cycle workbench combining hormone curves (FSH, LH, oestrogen,
 * progesterone, HCG), ovarian follicle -> corpus luteum transitions, and the
 * endometrium lining with coiled spiral arteries.
 */
export function MenstrualScene({
  cycleLength,
  day,
  hormones,
  luteal,
  onDay,
  outcome,
  parts,
}: {
  readonly cycleLength: number;
  readonly day: number;
  readonly hormones: Readonly<Record<Hormone, string>>;
  readonly luteal: number;
  readonly onDay: (next: number) => void;
  readonly outcome: Outcome;
  readonly parts: Readonly<
    Record<
      | "ovary"
      | "follicle"
      | "oocyte"
      | "corpusLuteum"
      | "endometrium"
      | "artery",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(0);

  if (!playing) {
    clock.current = 0;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    if (clock.current >= 0.45) {
      clock.current = 0;
      onDay(day >= cycleLength ? 1 : day + 1);
    }
  });

  const ov = ovulationDay(cycleLength, luteal);
  const snap = snapshotAt(day, cycleLength, luteal, outcome);
  const cursorX = -0.85 + ((day - 1) / Math.max(1, cycleLength - 1)) * 1.7;

  const geometries = useMemo(
    () =>
      Arr.map(HORMONE_SERIES, ([hormone, color]) => {
        const pts = curvePoints(hormone, cycleLength, luteal, outcome);
        const segs = Arr.flatMap(pts, (a, i) => {
          const b = pts[i + 1];
          return b === undefined
            ? []
            : [new Vector3(a[0], a[1], a[2]), new Vector3(b[0], b[1], b[2])];
        });
        const geo = new BufferGeometry();
        geo.setFromPoints(segs);
        return { color, geo, hormone };
      }),
    [cycleLength, luteal, outcome]
  );

  useEffect(
    () => () => {
      for (const entry of geometries) {
        entry.geo.dispose();
      }
    },
    [geometries]
  );

  const isPostOvulation = day > ov;
  const follicleScale = Math.min(
    1,
    0.35 + (Math.min(day, ov) / Math.max(1, ov)) * 0.65
  );

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      {/* Back hormone chart board */}
      <mesh position={[0, 0.8, -0.26]}>
        <boxGeometry args={[1.9, 0.72, 0.03]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.paper}
          roughness={0.85}
        />
      </mesh>
      {Arr.map(geometries, ({ color, geo, hormone }) =>
        hormone === "hcg" && outcome !== "pregnancy" ? null : (
          <lineSegments geometry={geo} key={hormone}>
            <lineBasicMaterial color={color} />
          </lineSegments>
        )
      )}

      {/* Moving day cursor line */}
      <mesh position={[cursorX, 0.8, -0.2]}>
        <boxGeometry args={[0.014, 0.66, 0.014]} />
        <meshStandardMaterial color={PLOT_COLORS.slate} />
      </mesh>

      {/* Active hormone indicator dots on cursor */}
      <ThreeLabel
        anchorX="left"
        color={ink}
        gap={0.03}
        position={[0.98, 1.04, -0.2]}
      >
        {hormones.lh}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        gap={0.03}
        position={[0.98, 0.84, -0.2]}
      >
        {hormones.progesterone}
      </ThreeLabel>
      {outcome === "pregnancy" && (
        <ThreeLabel
          anchorX="left"
          color={ink}
          gap={0.03}
          position={[0.98, 0.64, -0.2]}
        >
          {hormones.hcg}
        </ThreeLabel>
      )}

      {/* Front left: Ovary showing developing follicle -> ovulating oocyte -> corpus luteum */}
      <group position={[-0.48, 0.24, 0.18]}>
        <mesh castShadow scale={[1.3, 0.9, 0.65]}>
          <sphereGeometry args={[0.2, 22, 22]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.ovary}
            opacity={0.55}
            transparent
          />
        </mesh>
        {isPostOvulation ? (
          <mesh castShadow position={[0.04, 0.02, 0.09]}>
            <sphereGeometry
              args={[
                outcome === "miscarriage" && day >= ov + 9 ? 0.045 : 0.095,
                18,
                18,
              ]}
            />
            <meshStandardMaterial color={PLOT_COLORS.amber} />
          </mesh>
        ) : (
          <group position={[-0.02, 0.02, 0.08]}>
            <mesh castShadow scale={follicleScale}>
              <sphereGeometry args={[0.1, 18, 18]} />
              <meshStandardMaterial
                color={PLOT_COLORS.teal}
                opacity={0.7}
                transparent
              />
            </mesh>
            <mesh
              position={[day === ov ? 0.14 : 0, day === ov ? 0.12 : 0, 0.04]}
            >
              <sphereGeometry args={[0.038, 14, 14]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.eggNucleus} />
            </mesh>
          </group>
        )}
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.04}
          position={[0, -0.18, 0]}
        >
          {isPostOvulation ? parts.corpusLuteum : parts.follicle}
        </ThreeLabel>
      </group>

      {/* Front right: Endometrium lining thickening/shedding with spiral arteries */}
      <group position={[0.42, 0.04, 0.18]}>
        <mesh castShadow position={[0, (snap.lining * 0.36) / 2, 0]}>
          <boxGeometry args={[0.72, snap.lining * 0.36, 0.24]} />
          <meshStandardMaterial
            color={CELL_COLORS.reticulum}
            roughness={0.55}
          />
        </mesh>
        {Arr.map([-0.22, 0, 0.22] as const, (x) => (
          <mesh key={x} position={[x, (snap.lining * 0.34) / 2, 0.125]}>
            <cylinderGeometry args={[0.012, 0.012, snap.lining * 0.34, 10]} />
            <meshStandardMaterial color={BIOLOGY_COLORS.blood} />
          </mesh>
        ))}
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.04}
          position={[0, -0.02, 0.14]}
        >
          {parts.endometrium}
        </ThreeLabel>
      </group>
    </group>
  );
}
