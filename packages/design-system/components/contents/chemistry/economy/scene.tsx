import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  FEED,
  FeedHopperManifold,
  HOPPER_POS,
  PRODUCT,
  PRODUCT_FLASK_POS,
  ProductAndWasteStations,
  REACTOR_X,
  REACTOR_Z,
  WASTE,
  WASTE_BEAKER_POS,
} from "@repo/design-system/components/contents/chemistry/economy/geometry";
import type { SynthesisRoute } from "@repo/design-system/components/contents/chemistry/economy/model";
import { evaluateAtomEconomy } from "@repo/design-system/components/contents/chemistry/economy/model";
import {
  CatalyticSwirl,
  SynthesisReactor,
} from "@repo/design-system/components/contents/chemistry/economy/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  pointOn,
  rideOn,
  trackOf,
} from "@repo/design-system/components/three/form/path";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const FEED_PULSES = Arr.makeBy(4, (index) => index / 4);
const PRODUCT_PULSES = Arr.makeBy(4, (index) => index / 4);
const WASTE_PULSES = Arr.makeBy(3, (index) => index / 3);

const FEED_TRACK = trackOf(FEED);
const PRODUCT_TRACK = trackOf(PRODUCT);
const WASTE_TRACK = trackOf(WASTE);

function EconomyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.34, 1.05] : [0.02, 0.26, 0.82]}
      cameraTarget={[0.02, 0.145, 0.02]}
      fov={38}
      maxDistance={1.8}
      minDistance={0.35}
    />
  );
}

export function AtomEconomyScene({
  parts,
  route,
}: {
  readonly parts: Readonly<
    Record<
      "byproductWaste" | "desiredProduct" | "reactantFeed" | "reactorChamber",
      string
    >
  >;
  readonly route: SynthesisRoute;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();
  const feedPulsesRef = useRef<Group>(null);
  const productPulsesRef = useRef<Group>(null);
  const wastePulsesRef = useRef<Group>(null);
  const swirlRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reading = evaluateAtomEconomy(route);
  const hasWaste = reading.wasteSpheres > 0;

  useVisualStop(() => {
    phaseRef.current = 0;
    rideOn(FEED_TRACK, feedPulsesRef.current?.children ?? [], FEED_PULSES, 0);
    rideOn(
      PRODUCT_TRACK,
      productPulsesRef.current?.children ?? [],
      PRODUCT_PULSES,
      0
    );
    rideOn(
      WASTE_TRACK,
      wastePulsesRef.current?.children ?? [],
      WASTE_PULSES,
      0
    );
    if (swirlRef.current !== null) {
      swirlRef.current.rotation.y = 0;
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.58;
    const t = phaseRef.current;

    rideOn(FEED_TRACK, feedPulsesRef.current?.children ?? [], FEED_PULSES, t);
    rideOn(
      PRODUCT_TRACK,
      productPulsesRef.current?.children ?? [],
      PRODUCT_PULSES,
      t * (0.55 + (reading.economyPercent / 100) * 0.5)
    );
    if (hasWaste) {
      rideOn(
        WASTE_TRACK,
        wastePulsesRef.current?.children ?? [],
        WASTE_PULSES,
        t * 0.7
      );
    }
    if (swirlRef.current !== null) {
      swirlRef.current.rotation.y = t * Math.PI * 1.4;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <EconomyCamera />
      <LabBench width={2.8} />

      <FeedHopperManifold />
      <SynthesisReactor>
        <group ref={swirlRef}>
          <CatalyticSwirl
            productSpheres={reading.productSpheres}
            wasteSpheres={reading.wasteSpheres}
          />
        </group>
      </SynthesisReactor>
      <ProductAndWasteStations
        economyPercent={reading.economyPercent}
        wasteSpheres={reading.wasteSpheres}
      />

      {/* Animated cyan reactant molecule clusters streaming from hopper into reactor */}
      <group ref={feedPulsesRef}>
        {Arr.map(FEED_PULSES, (offset) => {
          const pt = pointOn(FEED_TRACK, offset);
          return (
            <group key={`feed-${offset}`} position={pt}>
              <mesh>
                <sphereGeometry args={[0.0068, 12, 10]} />
                <meshStandardMaterial
                  color={PROCESS_COLORS.ammoniaCyan}
                  emissive={PROCESS_COLORS.ammoniaCyan}
                  emissiveIntensity={0.48}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0.005, 0.003, 0.003]}>
                <sphereGeometry args={[0.0044, 10, 8]} />
                <meshStandardMaterial
                  color={PROCESS_COLORS.silicaBlue}
                  emissive={PROCESS_COLORS.silicaBlue}
                  emissiveIntensity={0.35}
                  roughness={0.22}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Animated green product spheres streaming along upper glass delivery arm */}
      <group ref={productPulsesRef}>
        {Arr.map(PRODUCT_PULSES, (offset) => {
          const pt = pointOn(PRODUCT_TRACK, offset);
          return (
            <mesh key={`prod-${offset}`} position={pt}>
              <sphereGeometry args={[0.0056, 12, 10]} />
              <meshStandardMaterial
                color={PROCESS_COLORS.greenProduct}
                emissive={PROCESS_COLORS.greenProduct}
                emissiveIntensity={0.44}
                roughness={0.2}
              />
            </mesh>
          );
        })}
      </group>

      {/* Animated byproduct waste chunks traveling down drain pipe when waste > 0 */}
      {hasWaste ? (
        <group ref={wastePulsesRef}>
          {Arr.map(WASTE_PULSES, (offset) => {
            const pt = pointOn(WASTE_TRACK, offset);
            return (
              <mesh key={`waste-${offset}`} position={pt}>
                <dodecahedronGeometry args={[0.0048, 0]} />
                <meshStandardMaterial
                  color={PROCESS_COLORS.wasteSlate}
                  roughness={0.75}
                />
              </mesh>
            );
          })}
        </group>
      ) : null}

      {/* Adaptive-ink labels with generous separation */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[HOPPER_POS[0], 0.252, HOPPER_POS[2]]}
      >
        <span>{parts.reactantFeed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[REACTOR_X, 0.312, REACTOR_Z]}
      >
        <span>{parts.reactorChamber}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[PRODUCT_FLASK_POS[0], 0.242, PRODUCT_FLASK_POS[2]]}
      >
        <span>{parts.desiredProduct}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[WASTE_BEAKER_POS[0], 0.135, WASTE_BEAKER_POS[2]]}
      >
        <span>{parts.byproductWaste}</span>
      </ThreeLabel>
    </group>
  );
}
