import { useFrame } from "@react-three/fiber";
import {
  TUBE_DROP,
  type TubeAir,
  TubeAirSchema,
  tubeDrops,
  tubeTimes,
} from "@repo/design-system/components/contents/physics/kinematics/vacuum/fall";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
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
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useRef, useState } from "react";
import type { Group } from "three";

/** The tube: its inner radius, its height, and the height of its base, in metres. */
const TUBE = { base: 0.06, height: 1.3, radius: 0.07 } as const;

/** Where the coin and the feather start: just under the stopper. */
const START = TUBE.base + TUBE.height - 0.1;

/** How long the drop waits before it starts, so the release can be seen, in seconds. */
const LEAD_IN = 0.6;

/** The glass tube on its wooden base, closed by rubber stoppers, with the pump hose at the bottom. */
function GlassTube() {
  return (
    <group>
      <mesh castShadow position={[0, TUBE.base / 2, 0]} receiveShadow>
        <boxGeometry args={[0.32, TUBE.base, 0.22]} />
        <meshStandardMaterial color={MATERIAL.bark} roughness={0.7} />
      </mesh>
      <mesh position={[0, TUBE.base + TUBE.height / 2, 0]}>
        <cylinderGeometry
          args={[
            TUBE.radius + 0.004,
            TUBE.radius + 0.004,
            TUBE.height,
            48,
            1,
            true,
          ]}
        />
        <meshPhysicalMaterial
          clearcoat={1}
          color={MATERIAL.glass}
          ior={1.5}
          roughness={0.08}
          thickness={0.006}
          transmission={0.92}
          transparent
        />
      </mesh>
      {Arr.map([TUBE.base + 0.02, TUBE.base + TUBE.height - 0.02], (height) => (
        <mesh castShadow key={height} position={[0, height, 0]}>
          <cylinderGeometry
            args={[TUBE.radius + 0.008, TUBE.radius + 0.008, 0.05, 32]}
          />
          <meshStandardMaterial color={MATERIAL.stopper} roughness={0.85} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0.16, TUBE.base + 0.02, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[0.1, 0.009, 12, 32, Math.PI]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** A coin, a brass disc lying flat as it falls. */
function Coin() {
  return (
    <mesh castShadow rotation={[0.2, 0, 0.1]}>
      <cylinderGeometry args={[0.02, 0.02, 0.003, 32]} />
      <meshStandardMaterial
        color={MATERIAL.batteryTerminal}
        metalness={1}
        roughness={0.25}
      />
    </mesh>
  );
}

/** A small white feather: a soft vane around a thin shaft. */
function Feather() {
  return (
    <group rotation={[0, 0, 0.35]}>
      <mesh castShadow scale={[0.02, 0.05, 0.003]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color={MATERIAL.foam} roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.012, 0]}>
        <cylinderGeometry args={[0.001, 0.001, 0.1, 6]} />
        <meshStandardMaterial color={MATERIAL.cabinet} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The two bodies falling inside the tube, run by the card's play clock. */
function FallScene({ air }: { readonly air: TubeAir }) {
  const coin = useRef<Group>(null);
  const feather = useRef<Group>(null);
  const { advance, playing } = useTimeline(-LEAD_IN, tubeTimes(air).feather);

  useFrame((_, delta) => {
    const time = advance(delta);
    const drops = tubeDrops(air, time);
    coin.current?.position.set(-0.028, START - drops.coin, 0);
    const sway = air === "air" ? Math.sin(Math.max(time, 0) * 5) * 0.012 : 0;
    feather.current?.position.set(0.028 + sway, START - drops.feather, 0);
    feather.current?.rotation.set(
      0,
      Math.max(time, 0) * (air === "air" ? 2 : 0),
      sway * 8
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <GlassTube />
      <group ref={coin}>
        <Coin />
      </group>
      <group ref={feather}>
        <Feather />
      </group>
    </group>
  );
}

interface FeatherCoinVacuumLabProps {
  description: ReactNode;
  labels: {
    airs: Record<TubeAir, ReactNode>;
    chooseAir: string;
    coinTime: ReactNode;
    drop: ReactNode;
    featherTime: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A coin and a feather let go together inside a tall glass tube. With air
 * in the tube the coin lands first and the feather drifts down; with the air
 * pumped out nothing holds the feather back, and both fall side by side,
 * landing together after the same free-fall time.
 */
export function FeatherCoinVacuumLab({
  description,
  labels,
  title,
}: FeatherCoinVacuumLabProps) {
  const [air, setAir] = useState<TubeAir>("vacuum");
  const quantity = useQuantity();
  const times = tubeTimes(air);
  const isAir = Schema.is(TubeAirSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAir}
          gridColumns="2"
          onValueChange={(value) => {
            if (isAir(value)) {
              setAir(value);
            }
          }}
          type="single"
          value={air}
          variant="outline"
        >
          <ToggleGroupItem value="air">{labels.airs.air}</ToggleGroupItem>
          <ToggleGroupItem value="vacuum">{labels.airs.vacuum}</ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.9} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.42, 0.85, 1.95]}
              cameraTarget={[0, 0.7, 0]}
              fov={40}
              maxDistance={3.2}
              minDistance={0.5}
            />
            <FallScene air={air} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.drop}
            value={<InlineMath math={quantity(TUBE_DROP, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.coinTime}
            value={<InlineMath math={quantity(times.coin, "\\text{ s}", 2)} />}
          />
          <VisualFactTabular
            label={labels.featherTime}
            value={
              <InlineMath math={quantity(times.feather, "\\text{ s}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
