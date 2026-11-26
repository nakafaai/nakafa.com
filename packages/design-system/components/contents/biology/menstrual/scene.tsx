import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useMenstrualGeometries } from "@repo/design-system/components/contents/biology/menstrual/anatomy";
import type {
  Hormone,
  Outcome,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";
import {
  curvePoints,
  ovulationDay,
  snapshotAt,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.94, 2.55];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

const HORMONE_SERIES: readonly (readonly [Hormone, string])[] = [
  ["fsh", PLOT_COLORS.violet],
  ["lh", PLOT_COLORS.pink],
  ["oestrogen", PLOT_COLORS.teal],
  ["progesterone", PLOT_COLORS.amber],
  ["hcg", PLOT_COLORS.orange],
];

/**
 * 3D menstrual cycle workbench combining glowing 3D hormone curves (FSH, LH,
 * oestrogen, progesterone, hCG), cutaway ovarian follicle -> corpus luteum
 * anatomy, and layered endometrium with coiled helical spiral arteries.
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

  useVisualStop(() => {
    clock.current = 0;
    onDay(1);
  });

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
  const liningH = Math.max(0.06, snap.lining * 0.34);

  const { arteries, endometrium, luteum, ovary } =
    useMenstrualGeometries(liningH);

  // Smooth 3D glowing TubeGeometry hormone traces over the frosted glass chart display.
  const curves = useMemo(
    () =>
      Arr.map(HORMONE_SERIES, ([hormone, color]) => {
        const pts = Arr.map(
          curvePoints(hormone, cycleLength, luteal, outcome),
          ([x, y, z]) => new Vector3(x, y, z)
        );
        const geo = new TubeGeometry(
          new CatmullRomCurve3(pts),
          56,
          0.008,
          8,
          false
        );
        return { color, geo, hormone };
      }),
    [cycleLength, luteal, outcome]
  );

  useEffect(
    () => () => {
      for (const entry of curves) {
        entry.geo.dispose();
      }
    },
    [curves]
  );

  const isPostOvulation = day > ov;
  const follicleScale = Math.min(
    1,
    0.38 + (Math.min(day, ov) / Math.max(1, ov)) * 0.62
  );
  const luteumScale = outcome === "miscarriage" && day >= ov + 9 ? 0.52 : 1;

  return (
    <group>
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      {/* Laboratory specimen bench */}
      <mesh position={[0, -0.025, 0.04]} receiveShadow>
        <boxGeometry args={[2.3, 0.05, 1.15]} />
        <SurfaceMaterial
          bump={0.22}
          color={LABORATORY_COLORS.cabinet}
          roughness={0.72}
          surface="concrete"
        />
      </mesh>

      {/* Frosted glass hormone chart board with 3D glowing hormone tubes */}
      <group position={[0, 0.84, -0.26]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.94, 0.72, 0.036]} />
          <meshPhysicalMaterial
            clearcoat={0.7}
            clearcoatRoughness={0.18}
            color={LABORATORY_COLORS.paper}
            opacity={0.9}
            roughness={0.28}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.37, 0.005]}>
          <boxGeometry args={[1.98, 0.025, 0.055]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.plinth}
            metalness={0.35}
            roughness={0.45}
          />
        </mesh>
      </group>
      {Arr.map(curves, ({ color, geo, hormone }) =>
        hormone === "hcg" && outcome !== "pregnancy" ? null : (
          <mesh geometry={geo} key={hormone} position={[0, 0.04, 0.01]}>
            <meshPhysicalMaterial
              clearcoat={0.6}
              color={color}
              emissive={color}
              emissiveIntensity={0.22}
              roughness={0.26}
            />
          </mesh>
        )
      )}

      {/* Translucent day-cursor indicator blade */}
      <mesh position={[cursorX, 0.84, -0.21]}>
        <boxGeometry args={[0.014, 0.68, 0.024]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={PLOT_COLORS.slate}
          opacity={0.78}
          roughness={0.2}
          transparent
        />
      </mesh>

      {/* Compact unclipped hormone legend aligned neatly across the top of the chart */}
      <ThreeLabel
        color={PLOT_COLORS.violet}
        fontSize="compact"
        position={[-0.84, 1.26, -0.22]}
      >
        <span>{hormones.fsh}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.pink}
        fontSize="compact"
        position={[-0.5, 1.26, -0.22]}
      >
        <span>{hormones.lh}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.teal}
        fontSize="compact"
        position={[-0.04, 1.26, -0.22]}
      >
        <span>{hormones.oestrogen}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="compact"
        position={[0.56, 1.26, -0.22]}
      >
        <span>{hormones.progesterone}</span>
      </ThreeLabel>
      {outcome === "pregnancy" ? (
        <ThreeLabel
          color={PLOT_COLORS.orange}
          fontSize="compact"
          position={[0.94, 1.26, -0.22]}
        >
          <span>{hormones.hcg}</span>
        </ThreeLabel>
      ) : null}

      {/* Front left: Cutaway ovary with maturing Graafian follicle / ovulating oocyte / corpus luteum */}
      <group position={[-0.5, 0.25, 0.22]}>
        <mesh castShadow geometry={ovary} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.42}
            clearcoatRoughness={0.3}
            color={BIOLOGY_COLORS.skinClay}
            opacity={0.62}
            roughness={0.44}
            transparent
          />
        </mesh>
        {isPostOvulation ? (
          <mesh
            castShadow
            geometry={luteum}
            position={[0.03, 0.01, 0.07]}
            scale={luteumScale}
          >
            <meshPhysicalMaterial
              clearcoat={0.48}
              color={PLOT_COLORS.amber}
              roughness={0.38}
            />
          </mesh>
        ) : (
          <group position={[-0.02, 0.01, 0.065]}>
            {/* Fluid-filled follicular antrum */}
            <mesh castShadow scale={follicleScale}>
              <sphereGeometry args={[0.105, 24, 20]} />
              <meshPhysicalMaterial
                clearcoat={0.85}
                clearcoatRoughness={0.12}
                color={PLOT_COLORS.teal}
                opacity={0.64}
                roughness={0.18}
                transparent
              />
            </mesh>
            {/* Oocyte + glowing zona pellucida released on ovulation day */}
            <mesh
              castShadow
              position={[day === ov ? 0.17 : 0, day === ov ? 0.14 : 0, 0.045]}
            >
              <sphereGeometry args={[0.042, 18, 16]} />
              <meshPhysicalMaterial
                clearcoat={0.75}
                color={BIOLOGY_COLORS.eggNucleus}
                roughness={0.24}
              />
            </mesh>
          </group>
        )}
        <ThreeLabel color={ink} fontSize="compact" position={[0, -0.21, 0.18]}>
          <span>{isPostOvulation ? parts.corpusLuteum : parts.follicle}</span>
        </ThreeLabel>
      </group>

      {/* Front right: Layered uterine wall (myometrium + glandular endometrium + helical spiral arteries) */}
      <group position={[0.46, 0.02, 0.2]}>
        {/* Muscular myometrium base */}
        <mesh castShadow position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[0.78, 0.06, 0.3]} />
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={BIOLOGY_COLORS.bloodDark}
            roughness={0.55}
          />
        </mesh>
        {/* Undulating glandular functional endometrium */}
        <mesh
          castShadow
          geometry={endometrium}
          position={[0, 0.06 + liningH * 0.5, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.42}
            clearcoatRoughness={0.28}
            roughness={0.44}
            vertexColors
          />
        </mesh>
        {/* Coiled helical spiral arteries */}
        <group position={[0, 0.06, 0]}>
          {Arr.map(arteries, (artery) => (
            <mesh castShadow geometry={artery.geo} key={artery.id}>
              <meshPhysicalMaterial
                clearcoat={0.65}
                color={BIOLOGY_COLORS.blood}
                roughness={0.28}
              />
            </mesh>
          ))}
        </group>
        <ThreeLabel color={ink} fontSize="compact" position={[0, -0.02, 0.24]}>
          <span>{parts.endometrium}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
