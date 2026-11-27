import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  BEAKER_X,
  BEAKER_Z,
  BenchPhMeter,
  METER_X,
  METER_Z,
  REACTION_BUBBLES,
  ReactionBeakerStation,
} from "@repo/design-system/components/contents/chemistry/oxide/apparatus";
import {
  LATTICE_X,
  LATTICE_Z,
  OxideMicrostructure,
} from "@repo/design-system/components/contents/chemistry/oxide/lattice";
import type { PeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import { evaluatePeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function OxideCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [-0.01, 0.37, 1.26] : [-0.01, 0.3, 0.96]}
      cameraTarget={[-0.01, 0.125, 0.03]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.38}
    />
  );
}

export function PeriodThreeOxideScene({
  oxide,
  parts,
}: {
  readonly oxide: PeriodOxide;
  readonly parts: Readonly<
    Record<"latticeModel" | "oxideSample" | "phMeter" | "waterBeaker", string>
  >;
}) {
  const labelInk = useLabelInk();
  const turntableRef = useRef<Group>(null);
  const bubblesRef = useRef<Group>(null);
  const { advance, playing } = useSimulationClock(0);
  const profile = evaluatePeriodOxide(oxide);

  const liquidColor = Match.value(profile.nature).pipe(
    Match.when("basic", () =>
      oxide === "na2o" ? PROCESS_COLORS.alkaliPurple : PROCESS_COLORS.alkaliBlue
    ),
    Match.when("amphoteric", () => PROCESS_COLORS.neutralGreen),
    Match.when("acidic", () =>
      oxide === "sio2" ? PROCESS_COLORS.neutralGreen : PROCESS_COLORS.acidRed
    ),
    Match.exhaustive
  );

  useFrame((_, delta) => {
    const t = advance(delta);
    if (turntableRef.current !== null) {
      turntableRef.current.rotation.y = t * 0.55;
    }
    if (bubblesRef.current !== null) {
      for (let i = 0; i < bubblesRef.current.children.length; i += 1) {
        const child = bubblesRef.current.children[i];
        const spec = REACTION_BUBBLES[i];
        if (child !== undefined && spec !== undefined) {
          const cycle = (t * 0.8 + spec.offset) % 1;
          child.position.set(
            spec.x + Math.sin(t * 4 + i) * 0.0025,
            0.022 + cycle * 0.048,
            spec.z
          );
        }
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <OxideCamera />
      <LabBench width={2.6} />

      <BenchPhMeter indicatorColor={liquidColor} ph={profile.ph} />
      <ReactionBeakerStation
        bubblesRef={bubblesRef}
        liquidColor={liquidColor}
        oxide={oxide}
      />
      <OxideMicrostructure oxide={oxide} turntableRef={turntableRef} />

      {/* Non-overlapping adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[METER_X + 0.02, 0.185, METER_Z + 0.02]}
      >
        <span>
          {parts.phMeter} (pH {profile.ph.toFixed(1)})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[BEAKER_X + 0.025, 0.262, BEAKER_Z]}
      >
        <span>{parts.waterBeaker}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[BEAKER_X - 0.02, 0.022, BEAKER_Z + 0.118]}
      >
        <span>{parts.oxideSample}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[LATTICE_X, 0.248, LATTICE_Z]}
      >
        <span>{parts.latticeModel}</span>
      </ThreeLabel>
    </group>
  );
}
