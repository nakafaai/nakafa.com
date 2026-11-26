import { useFrame } from "@react-three/fiber";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  KITE,
  sailGeometry,
  tailGeometry,
} from "@repo/design-system/components/contents/physics/vector/kite/sail";
import type { Line } from "@repo/design-system/components/contents/physics/vector/kite/string";
import {
  LineSchema,
  lineParts,
} from "@repo/design-system/components/contents/physics/vector/kite/string";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import {
  useVisualScene,
  useVisualStop,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

/** Metres of arrow per newton of tension. */
const ARROW_SCALE = 0.25;

/** Where the bridle meets the flying line, in front of the sail's face. */
const TOW = [0, 0.15, 0.9] as const;

/** The points of the spine the two bridle legs are tied to. */
const BRIDLE = [
  [0, KITE.spine * KITE.cross * 0.75, -0.02],
  [0, -KITE.spine * (1 - KITE.cross) * 0.55, -0.02],
] as const;

/**
 * A classic diamond kite of real proportions: a two-tone ripstop sail
 * bellied by the wind, hemmed all round, on a spine and a spreader bowed
 * back across it, its two-leg bridle meeting the flying line in front of
 * the sail, and a ribbon tail streaming from the tail. The tow point is at
 * the origin.
 */
function Kite() {
  const sail = useMemo(() => sailGeometry(), []);
  const streamer = useMemo(() => tailGeometry(8, 0.14, 4), []);
  useEffect(
    () => () => {
      sail.dispose();
      streamer.dispose();
    },
    [sail, streamer]
  );
  const nose = KITE.spine * KITE.cross;
  const tail = -KITE.spine * (1 - KITE.cross);
  const tip = KITE.spreader / 2;
  const hem = [
    [0, nose, 0],
    [-tip, 0, 0],
    [0, tail, 0],
    [tip, 0, 0],
    [0, nose, 0],
  ] as const;
  const spreader = [
    [-tip, 0, -0.03],
    [0, 0, -0.16],
    [tip, 0, -0.03],
  ] as const;

  return (
    <group position={[-TOW[0], -TOW[1], -TOW[2]]}>
      <mesh castShadow geometry={sail} receiveShadow>
        <SurfaceMaterial
          attach="material-0"
          color={MACHINE_COLORS.kiteNylon}
          repeat={[1.5, 1.5]}
          side={DoubleSide}
          surface="cloth"
        />
        <SurfaceMaterial
          attach="material-1"
          color={MACHINE_COLORS.kiteNavy}
          repeat={[1.5, 1.5]}
          side={DoubleSide}
          surface="cloth"
        />
      </mesh>
      <Strake
        color={CAR_COLORS.tyre}
        points={hem}
        radius={0.014}
        surface="cloth"
      />
      <Rod
        color={MACHINE_COLORS.carbonShell}
        from={[0, nose, -0.03]}
        radius={0.02}
        to={[0, tail, -0.03]}
      />
      <Strake
        color={MACHINE_COLORS.carbonShell}
        points={spreader}
        radius={0.018}
        surface="plastic"
      />
      {Arr.map(BRIDLE, (point) => (
        <Rod
          color={MACHINE_COLORS.cotton}
          from={point}
          key={point[1]}
          radius={0.006}
          to={TOW}
        />
      ))}
      <mesh castShadow geometry={streamer} position={[0, tail, -0.02]}>
        <SurfaceMaterial
          color={MACHINE_COLORS.cotton}
          repeat={[1, 2]}
          side={DoubleSide}
          surface="cloth"
        />
      </mesh>
    </group>
  );
}

/** The stake in the grass, the string up to the swaying kite, and the string's pull on the stake split into its parts. */
function KiteScene({
  angle,
  line,
}: {
  readonly angle: number;
  readonly line: Line;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const flier = useRef<Group>(null);
  const clock = useRef(0);
  const parts = lineParts(line, angle);
  const kite = [parts.downwind, parts.height, 0] as const;
  const tension = [
    parts.across * ARROW_SCALE,
    parts.up * ARROW_SCALE,
    0,
  ] as const;

  useVisualStop(() => {
    clock.current = 0;
    flier.current?.rotation.set(0, 0, 0);
  });

  useFrame((_, delta) => {
    if (playing) {
      clock.current += Math.min(delta, 0.1);
    }
    flier.current?.rotation.set(
      0.25 * Math.sin(clock.current * 1.3),
      0.15 * Math.sin(clock.current * 0.7),
      0
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.045, 0.02, 0.8, 12]} />
        <SurfaceMaterial
          color={MACHINE_COLORS.ash}
          repeat={[1, 2]}
          surface="wood"
        />
      </mesh>
      <Rod
        color={MACHINE_COLORS.cotton}
        from={[0, 0.6, 0]}
        radius={0.015}
        to={kite}
      />
      <group position={kite} ref={flier}>
        <group rotation={[-0.3, -0.7, (-angle * Math.PI) / 540]} scale={1.4}>
          <Kite />
        </group>
      </group>
      <FixedArrow
        color={PLOT_COLORS.violet}
        from={[0, 0.6, 0.3]}
        head={0.7}
        thickness={0.09}
        vector={tension}
      />
      <FixedArrow
        color={PLOT_COLORS.teal}
        from={[0, 0.6, 0.3]}
        head={0.6}
        thickness={0.07}
        vector={[tension[0], 0, 0]}
      />
      <FixedArrow
        color={PLOT_COLORS.amber}
        from={[tension[0], 0.6, 0.3]}
        head={0.6}
        thickness={0.07}
        vector={[0, tension[1], 0]}
      />
      <ThreeLabel
        color={PLOT_COLORS.violet}
        fontSize="reading"
        position={[tension[0] * 0.45 - 1.2, 0.6 + tension[1] * 0.55, 0.3]}
      >
        <InlineMath math="\vec T" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.teal}
        fontSize="reading"
        position={[tension[0] * 0.5, -0.5, 0.3]}
      >
        <InlineMath math="T\sin\theta" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="reading"
        position={[tension[0] + 1.6, 0.6 + tension[1] * 0.5, 0.3]}
      >
        <InlineMath math="T\cos\theta" />
      </ThreeLabel>
    </group>
  );
}

interface KiteStringTensionLabProps {
  /** The string's angle from the vertical the card starts at, in degrees. */
  angle: number;
  description: NonNullable<ReactNode>;
  labels: {
    across: ReactNode;
    angle: ReactNode;
    angleName: string;
    up: ReactNode;
    viewLabel: string;
  };
  /** The string's length, in metres. */
  length: number;
  /** The string's tension, in newtons. */
  tension: number;
  title: NonNullable<ReactNode>;
}

/**
 * A kite on a string tied to a stake, the wind carrying it downwind. The
 * learner tilts the string away from the vertical: measured from that
 * axis, the string's pull on the stake splits into T cos θ straight up and
 * T sin θ along the ground.
 */
export function KiteStringTensionLab({
  angle: start,
  description,
  labels,
  length,
  tension,
  title,
}: KiteStringTensionLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(start);
  const line = useMemo(
    () => Schema.decodeSync(LineSchema)({ length, tension }),
    [length, tension]
  );
  const parts = lineParts(line, angle);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.angle}
          max={80}
          min={10}
          name={labels.angleName}
          onValueChange={setAngle}
          readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
          step={1}
          value={angle}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          ground="sand"
          reach={length * 0.7}
          setting="sky"
        >
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[length * 0.4, length * 0.45, length * 1.35]}
              cameraTarget={[length * 0.4, length * 0.42, 0]}
              fov={40}
              maxDistance={length * 3}
              minDistance={length * 0.4}
            />
            <KiteScene angle={angle} line={line} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.up}
            value={<InlineMath math={quantity(parts.up, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.across}
            value={
              <InlineMath math={quantity(parts.across, "\\text{ N}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
