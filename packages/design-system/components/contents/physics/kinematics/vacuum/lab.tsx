import { useFrame } from "@react-three/fiber";
import {
  Coin,
  Feather,
} from "@repo/design-system/components/contents/physics/kinematics/vacuum/bodies";
import type { TubeAir } from "@repo/design-system/components/contents/physics/kinematics/vacuum/fall";
import {
  TUBE_DROP,
  TubeAirSchema,
  tubeDrops,
  tubeTimes,
} from "@repo/design-system/components/contents/physics/kinematics/vacuum/fall";
import {
  TUBE,
  VacuumApparatus,
} from "@repo/design-system/components/contents/physics/kinematics/vacuum/tube";
import { DialGauge } from "@repo/design-system/components/contents/physics/solid/gauge";
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
import { Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";
import type { Group } from "three";

/** Where the coin and the feather start: just under the upper cap. */
const START = TUBE.base + TUBE.height - 0.1;

/** How long the drop waits before it starts, so the release can be seen, in seconds. */
const LEAD_IN = 0.6;

/** What the gauge reads with the room's air in the tube, and with it pumped out. */
const PRESSURE = { air: 0.76, vacuum: 0.03 } as const;

/** The two bodies falling inside the tube, run by the card's play clock. */
function FallScene({ air }: { readonly air: TubeAir }) {
  const coin = useRef<Group>(null);
  const feather = useRef<Group>(null);
  const { advance, playing } = useTimeline(-LEAD_IN, tubeTimes(air).feather);

  useFrame((_, delta) => {
    const time = advance(delta);
    const drops = tubeDrops(air, time);
    coin.current?.position.set(-0.03, START - drops.coin, 0);
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
      <VacuumApparatus>
        <DialGauge radius={TUBE.gauge} reading={PRESSURE[air]} />
      </VacuumApparatus>
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
  description: NonNullable<ReactNode>;
  labels: {
    airs: Record<TubeAir, ReactNode>;
    chooseAir: string;
    coinTime: ReactNode;
    drop: ReactNode;
    featherTime: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
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
        <ScienceStage reach={1.2} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[1.05, 0.98, 2.2]}
              cameraTarget={[0.3, 0.7, 0]}
              fov={40}
              maxDistance={3.6}
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
