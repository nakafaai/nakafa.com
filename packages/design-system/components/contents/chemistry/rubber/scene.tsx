import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  DisulfideBridges,
  LEFT_JAW_X,
  LOWER_Y,
  PolyisopreneChain,
  RIG_Z,
  TensileTestRig,
  UPPER_Y,
} from "@repo/design-system/components/contents/chemistry/rubber/apparatus";
import type { RubberState } from "@repo/design-system/components/contents/chemistry/rubber/model";
import { evaluateRubberStretch } from "@repo/design-system/components/contents/chemistry/rubber/model";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useRef } from "react";
import type { Group } from "three";

function RubberCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.37, 1.26] : [-0.01, 0.3, 0.99]}
      cameraTarget={[-0.01, 0.145, 0.03]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.38}
    />
  );
}

export function RubberVulcanizationScene({
  parts,
  state,
  stretchPercent,
}: {
  readonly parts: Readonly<
    Record<
      "doubleBond" | "isopreneChain" | "sulfurCrosslink" | "tensionArrow",
      string
    >
  >;
  readonly state: RubberState;
  readonly stretchPercent: number;
}) {
  const labelInk = useLabelInk();
  const upperRef = useRef<Group>(null);
  const lowerRef = useRef<Group>(null);
  const bridgeRef = useRef<Group>(null);
  const { advance, playing } = useSimulationClock(0);

  const strainFactor = stretchPercent / 100;
  const mech = evaluateRubberStretch(state, stretchPercent);

  const spanHalf = 0.175 + strainFactor * 0.048;
  const waveAmp = 0.017 - strainFactor * 0.011;
  const slipShift = mech.chainSlip * 0.14;
  const upperOffset = LEFT_JAW_X + spanHalf + slipShift;
  const lowerOffset = LEFT_JAW_X + spanHalf - slipShift * 0.35;
  const rightJawX = upperOffset + spanHalf;

  useFrame((_, delta) => {
    const t = advance(delta);
    const osc = Math.sin(t * 2.2);
    const slipOsc = mech.crosslinked ? osc * 0.006 : osc * 0.024;
    if (upperRef.current !== null) {
      upperRef.current.position.x = slipOsc;
      upperRef.current.rotation.x = osc * 0.045;
    }
    if (lowerRef.current !== null) {
      lowerRef.current.position.x = -slipOsc * 0.4;
      lowerRef.current.rotation.x = -osc * 0.035;
    }
    if (bridgeRef.current !== null) {
      bridgeRef.current.position.x = slipOsc * 0.35;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RubberCamera />
      <TensileTestRig
        rightJawX={rightJawX}
        state={state}
        strainFactor={strainFactor}
      />

      {/* Undulating 3D cis-polyisoprene chains and sulfur crosslinks */}
      <group position={[0, 0, RIG_Z]}>
        <group ref={upperRef}>
          <PolyisopreneChain
            showDoubleBonds={!mech.crosslinked}
            spanHalf={spanHalf}
            waveAmp={waveAmp}
            xOffset={upperOffset}
            yCenter={UPPER_Y}
          />
        </group>
        <group ref={lowerRef}>
          <PolyisopreneChain
            showDoubleBonds={!mech.crosslinked}
            spanHalf={spanHalf}
            waveAmp={waveAmp}
            xOffset={lowerOffset}
            yCenter={LOWER_Y}
          />
        </group>
        {mech.crosslinked ? (
          <group ref={bridgeRef}>
            <DisulfideBridges
              lowerOffset={lowerOffset}
              spanHalf={spanHalf}
              upperOffset={upperOffset}
              waveAmp={waveAmp}
            />
          </group>
        ) : null}
      </group>

      {/* Non-overlapping adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.14, 0.278, RIG_Z]}
      >
        <span>{parts.isopreneChain}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[rightJawX + 0.085, 0.278, RIG_Z]}
      >
        <span>{parts.tensionArrow}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.02, 0.088, RIG_Z + 0.075]}
      >
        <span>
          {mech.crosslinked ? parts.sulfurCrosslink : parts.doubleBond}
        </span>
      </ThreeLabel>
    </group>
  );
}
