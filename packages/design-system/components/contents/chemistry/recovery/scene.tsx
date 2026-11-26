import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  CycloneAndTubing,
  createFeedCurve,
  createProductCurve,
  createRecoveryCurve,
  PRODUCT_FLASK_POS,
  ProductAndWasteVessels,
  WASTE_CARBOY_POS,
} from "@repo/design-system/components/contents/chemistry/recovery/geometry";
import type { CatalysisMode } from "@repo/design-system/components/contents/chemistry/recovery/model";
import { evaluateCatalystRecovery } from "@repo/design-system/components/contents/chemistry/recovery/model";
import {
  FeedManifold,
  PackedReactor,
  ReactorMedia,
} from "@repo/design-system/components/contents/chemistry/recovery/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { CatmullRomCurve3, Group } from "three";

const FEED_PULSES = Arr.makeBy(4, (index) => index / 4);
const LOOP_BEADS = Arr.makeBy(6, (index) => index / 6);
const PRODUCT_DROPS = Arr.makeBy(3, (index) => index / 3);

function wasteFillFraction(mode: CatalysisMode, cycleProgress: number) {
  return Match.value(mode).pipe(
    Match.when("stoichiometric", () => 0.25 + cycleProgress * 0.67),
    Match.when("homogeneous", () => 0.14 + cycleProgress * 0.36),
    Match.when("heterogeneous", () => 0.05 + cycleProgress * 0.09),
    Match.when("biocatalyst", () => 0.04 + cycleProgress * 0.06),
    Match.exhaustive
  );
}

function stepAlongCurve(
  group: Group | null,
  curve: CatmullRomCurve3,
  offsets: readonly number[],
  phase: number
) {
  if (group === null) {
    return;
  }
  for (let i = 0; i < group.children.length; i += 1) {
    const child = group.children[i];
    const offset = offsets[i];
    if (child !== undefined && offset !== undefined) {
      child.position.copy(curve.getPointAt((phase + offset) % 1));
    }
  }
}

function RecoveryCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.36, 1.06] : [0.03, 0.28, 0.84]}
      cameraTarget={[0.02, 0.165, 0.02]}
      fov={38}
      maxDistance={1.8}
      minDistance={0.35}
    />
  );
}

export function GreenCatalystScene({
  cycles,
  cyclesMax = 20,
  cyclesMin = 1,
  mode,
  parts,
}: {
  readonly cycles: number;
  readonly cyclesMax?: number;
  readonly cyclesMin?: number;
  readonly mode: CatalysisMode;
  readonly parts: Readonly<
    Record<
      | "catalystBed"
      | "productOut"
      | "reactantStream"
      | "recoveryLoop"
      | "wasteBin",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const feedPulsesRef = useRef<Group>(null);
  const loopBeadsRef = useRef<Group>(null);
  const productDropsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reading = evaluateCatalystRecovery(mode, cycles);
  const loopActive = reading.recoveredPercent > 0;
  const span = Math.max(1, cyclesMax - cyclesMin);
  const cycleProgress = Math.min(1, Math.max(0, (cycles - cyclesMin) / span));

  // Product flask fill scales across cycles in ALL 4 modes (including stoichiometric).
  const productLevel = 0.018 + cycleProgress * 0.072;
  // Waste carboy fill rises sharply with cycles in stoichiometric mode and stays tiny for recyclable catalysts.
  const wasteLevel = 0.008 + wasteFillFraction(mode, cycleProgress) * 0.098;

  const { feedCurve, productCurve, recoveryCurve } = useMemo(
    () => ({
      feedCurve: createFeedCurve(),
      productCurve: createProductCurve(),
      recoveryCurve: createRecoveryCurve(),
    }),
    []
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.55;
    const t = phaseRef.current;

    stepAlongCurve(feedPulsesRef.current, feedCurve, FEED_PULSES, t);
    if (loopActive) {
      const rate = 0.65 + (reading.recoveredPercent / 100) * 0.65;
      stepAlongCurve(loopBeadsRef.current, recoveryCurve, LOOP_BEADS, t * rate);
    }
    stepAlongCurve(
      productDropsRef.current,
      productCurve,
      PRODUCT_DROPS,
      t * 0.85
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RecoveryCamera />
      <LabBench width={2.8} />

      <FeedManifold />
      <PackedReactor>
        <ReactorMedia mode={mode} />
      </PackedReactor>
      <CycloneAndTubing active={loopActive} />
      <ProductAndWasteVessels
        mode={mode}
        productLevel={productLevel}
        wasteLevel={wasteLevel}
      />

      {/* Animated cyan reactant feed pulses */}
      <group ref={feedPulsesRef}>
        {Arr.map(FEED_PULSES, (offset) => {
          const pt = feedCurve.getPointAt(offset);
          return (
            <mesh key={`feed-${offset}`} position={[pt.x, pt.y, pt.z]}>
              <sphereGeometry args={[0.0072, 10, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.ammoniaCyan}
                emissive={PROCESS_COLORS.ammoniaCyan}
                emissiveIntensity={0.45}
                roughness={0.2}
              />
            </mesh>
          );
        })}
      </group>

      {/* Animated recycled catalyst beads along overhead cyclone loop */}
      {loopActive ? (
        <group ref={loopBeadsRef}>
          {Arr.map(LOOP_BEADS, (offset) => {
            const pt = recoveryCurve.getPointAt(offset);
            return (
              <mesh key={`loop-${offset}`} position={[pt.x, pt.y, pt.z]}>
                <sphereGeometry args={[0.0076, 12, 10]} />
                <meshStandardMaterial
                  color={PROCESS_COLORS.electronGold}
                  emissive={PROCESS_COLORS.electronGold}
                  emissiveIntensity={0.5}
                  roughness={0.22}
                />
              </mesh>
            );
          })}
        </group>
      ) : null}

      {/* Animated green product stream droplets */}
      <group ref={productDropsRef}>
        {Arr.map(PRODUCT_DROPS, (offset) => {
          const pt = productCurve.getPointAt(offset);
          return (
            <mesh key={`prod-${offset}`} position={[pt.x, pt.y, pt.z]}>
              <sphereGeometry args={[0.0048, 10, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.greenProduct}
                emissive={PROCESS_COLORS.greenProduct}
                emissiveIntensity={0.35}
                roughness={0.2}
              />
            </mesh>
          );
        })}
      </group>

      {/* Crisp adaptive-ink labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.23, 0.232, 0.02]}
      >
        <span>{parts.reactantStream}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.015, 0.372, 0.01]}
      >
        <span>{parts.recoveryLoop}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.01, 0.022, 0.135]}
      >
        <span>{parts.catalystBed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[PRODUCT_FLASK_POS[0], 0.215, PRODUCT_FLASK_POS[2]]}
      >
        <span>{parts.productOut}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[WASTE_CARBOY_POS[0], 0.215, WASTE_CARBOY_POS[2]]}
      >
        <span>{parts.wasteBin}</span>
      </ThreeLabel>
    </group>
  );
}
