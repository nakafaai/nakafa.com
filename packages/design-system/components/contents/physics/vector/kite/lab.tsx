import { useFrame } from "@react-three/fiber";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  type Line,
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
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** Metres of arrow per newton of tension. */
const ARROW_SCALE = 0.25;

/** The kite: a diamond of nylon on two spars, with a tail of bows, nose up toward the string. */
function Kite({ angle }: { readonly angle: number }) {
  return (
    <group rotation={[0, 0, (-angle * Math.PI) / 180]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.02, 4, 1]} />
        <meshStandardMaterial color={MATERIAL.kiteNylon} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.9, 0.02, 0.04]} />
        <meshStandardMaterial color={MATERIAL.bark} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.02, 1.9]} />
        <meshStandardMaterial color={MATERIAL.bark} roughness={0.7} />
      </mesh>
      {Arr.makeBy(5, (index) => (
        <mesh
          key={index}
          position={[0.35 * (index % 2) - 0.17, -0.05, 1.2 + index * 0.45]}
        >
          <boxGeometry args={[0.3, 0.01, 0.14]} />
          <meshStandardMaterial color={MATERIAL.deckWhite} roughness={0.7} />
        </mesh>
      ))}
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
      <mesh position={[0, 0.002, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color={MATERIAL.sand} roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.05, 0.03, 0.8, 10]} />
        <meshStandardMaterial color={MATERIAL.bark} roughness={0.8} />
      </mesh>
      <Rod
        color={MATERIAL.cotton}
        from={[0, 0.6, 0]}
        radius={0.015}
        to={kite}
      />
      <group position={kite} ref={flier}>
        <group rotation={[Math.PI / 2, 0, 0]} scale={2.4}>
          <Kite angle={-angle} />
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
  description: ReactNode;
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
  title: ReactNode;
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
    () => Schema.decodeUnknownSync(LineSchema)({ length, tension }),
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
        <ScienceStage floor={0} reach={length * 0.7} setting="sky">
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
