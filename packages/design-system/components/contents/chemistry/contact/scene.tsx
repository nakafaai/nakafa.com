import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  ABSORBER_X,
  BURNER_X,
  CONVERTER_X,
  ContactPlantSkid,
  createAbsorberToDilutionCurve,
  createBurnerToConverterCurve,
  createConverterToAbsorberCurve,
  createOutletPipeCurve,
  DILUTION_X,
  FLASK_X,
  PLANT_Z,
  StageDucts,
  SulfurBurner,
  VanadiumConverter,
} from "@repo/design-system/components/contents/chemistry/contact/geometry";
import type { ContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
import { evaluateContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";
import {
  AbsorptionTower,
  DilutionUnit,
} from "@repo/design-system/components/contents/chemistry/contact/towers";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";

const CASCADE_DROPS = 6;

function ContactCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.05, 0.44, 1.64] : [0.05, 0.35, 1.24]}
      cameraTarget={[0.05, 0.2, 0.02]}
      fov={38}
      maxDistance={2.8}
      minDistance={0.45}
    />
  );
}

function PlantFlowEffects({
  flameRef,
  playing,
  stage,
}: {
  readonly flameRef: RefObject<Group | null>;
  readonly playing: boolean;
  readonly stage: ContactStage;
}) {
  const curve1 = useMemo(createBurnerToConverterCurve, []);
  const curve2 = useMemo(createConverterToAbsorberCurve, []);
  const curve3 = useMemo(createAbsorberToDilutionCurve, []);
  const curve4 = useMemo(createOutletPipeCurve, []);

  const p1Ref = useRef<Mesh>(null);
  const p2Ref = useRef<Mesh>(null);
  const p3Ref = useRef<Mesh>(null);
  const p4Ref = useRef<Mesh>(null);
  const acidDropRef = useRef<Mesh>(null);
  const cascadeRefs = useRef<(Mesh | null)[]>([]);
  const phaseRef = useRef(0.35);

  const dropAngles = useMemo(
    () =>
      Arr.makeBy(
        CASCADE_DROPS,
        (index) => (index / CASCADE_DROPS) * Math.PI * 2
      ),
    []
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const dt = simulationStep(delta);
    phaseRef.current += dt * 0.55;
    const p = phaseRef.current;

    const placeOnCurve = (
      mesh: Mesh | null,
      curve: typeof curve1,
      offset: number,
      zShift: number
    ) => {
      if (mesh === null) {
        return;
      }
      mesh.position.copy(curve.getPointAt(offset % 1));
      mesh.position.z += zShift;
    };

    placeOnCurve(p1Ref.current, curve1, p, 0.013);
    placeOnCurve(p2Ref.current, curve2, p + 0.3, 0.013);
    placeOnCurve(p3Ref.current, curve3, p + 0.6, 0.013);
    placeOnCurve(p4Ref.current, curve4, p * 1.1, 0.011);

    if (acidDropRef.current !== null) {
      const dropT = (p * 1.8) % 1;
      acidDropRef.current.position.set(
        FLASK_X,
        0.146 - dropT * 0.072,
        PLANT_Z + 0.01
      );
    }
    if (flameRef.current !== null) {
      const base = stage === "roasting" ? 1.25 : 0.74;
      const flicker = 1 + Math.sin(p * 16) * 0.08;
      flameRef.current.scale.set(base, base * 1.1 * flicker, base);
    }
    const dropSpeed = stage === "oleumAbsorption" ? 1.5 : 0.8;
    for (let i = 0; i < CASCADE_DROPS; i += 1) {
      const mesh = cascadeRefs.current[i];
      if (!mesh) {
        continue;
      }
      const t = (p * dropSpeed + i / CASCADE_DROPS) % 1;
      const ang = dropAngles[i] ?? 0;
      mesh.position.set(
        ABSORBER_X + Math.cos(ang) * 0.032,
        0.31 - t * 0.19,
        PLANT_Z + Math.sin(ang) * 0.032
      );
    }
  });

  const init1 = curve1.getPointAt(0.45);
  const init2 = curve2.getPointAt(0.5);
  const init3 = curve3.getPointAt(0.5);
  const init4 = curve4.getPointAt(0.55);

  return (
    <group>
      <mesh position={[init1.x, init1.y, init1.z + 0.013]} ref={p1Ref}>
        <sphereGeometry args={[0.01, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.sulfurYellow}
          emissive={PROCESS_COLORS.sulfurYellow}
          emissiveIntensity={stage === "roasting" ? 1.35 : 0.65}
        />
      </mesh>
      <mesh position={[init2.x, init2.y, init2.z + 0.013]} ref={p2Ref}>
        <sphereGeometry args={[0.01, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.vanadiumOrange}
          emissive={PROCESS_COLORS.vanadiumOrange}
          emissiveIntensity={stage === "catalyticOxidation" ? 1.35 : 0.65}
        />
      </mesh>
      <mesh position={[init3.x, init3.y, init3.z + 0.013]} ref={p3Ref}>
        <sphereGeometry args={[0.01, 12, 10]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.oleumAmber}
          emissive={PROCESS_COLORS.oleumAmber}
          emissiveIntensity={stage === "oleumAbsorption" ? 1.35 : 0.65}
        />
      </mesh>
      <mesh position={[init4.x, init4.y, init4.z + 0.011]} ref={p4Ref}>
        <sphereGeometry args={[0.0085, 10, 8]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.oleumAmber}
          emissive={PROCESS_COLORS.oleumAmber}
          emissiveIntensity={stage === "dilution" ? 1.35 : 0.65}
        />
      </mesh>
      {/* Amber acid droplet falling from outlet pipe into receiving flask */}
      <mesh position={[FLASK_X, 0.115, PLANT_Z + 0.01]} ref={acidDropRef}>
        <sphereGeometry args={[0.0046, 10, 8]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={PROCESS_COLORS.oleumAmber}
          emissive={PROCESS_COLORS.oleumAmber}
          emissiveIntensity={stage === "dilution" ? 0.9 : 0.3}
          roughness={0.12}
        />
      </mesh>
      {/* Cascading amber H2SO4 droplets inside absorption tower */}
      {Arr.map(dropAngles, (ang, index) => (
        <mesh
          key={ang}
          position={[
            ABSORBER_X + Math.cos(ang) * 0.032,
            0.31 - (index / CASCADE_DROPS) * 0.19,
            PLANT_Z + Math.sin(ang) * 0.032,
          ]}
          ref={(el) => {
            cascadeRefs.current[index] = el;
          }}
        >
          <sphereGeometry args={[0.0048, 10, 8]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={PROCESS_COLORS.oleumAmber}
            emissive={PROCESS_COLORS.oleumAmber}
            emissiveIntensity={stage === "oleumAbsorption" ? 0.85 : 0.25}
            roughness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ContactSulfuricScene({
  parts,
  stage,
}: {
  readonly parts: Readonly<
    Record<
      "absorptionTower" | "acidPipe" | "burner" | "oleumTank" | "vanadiumBed",
      string
    >
  >;
  readonly stage: ContactStage;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const flameRef = useRef<Group>(null);
  const stageMeta = evaluateContactStage(stage);
  const beaconIntensity = 0.7 + stageMeta.temperatureC / 1400;
  const beaconByStage: Record<ContactStage, readonly [number, number]> = {
    catalyticOxidation: [CONVERTER_X, 0.42],
    dilution: [DILUTION_X, 0.335],
    oleumAbsorption: [ABSORBER_X, 0.42],
    roasting: [BURNER_X, 0.255],
  };
  const [beaconX, beaconY] = beaconByStage[stage];

  return (
    <group>
      <SimulationTicker running={playing} />
      <ContactCamera />
      <ContactPlantSkid />
      <SulfurBurner active={stage === "roasting"} flameRef={flameRef} />
      <VanadiumConverter active={stage === "catalyticOxidation"} />
      <AbsorptionTower active={stage === "oleumAbsorption"} />
      <DilutionUnit active={stage === "dilution"} />
      <StageDucts stage={stage} />
      <PlantFlowEffects flameRef={flameRef} playing={playing} stage={stage} />
      {/* Subtle overhead active stage halo indicator */}
      <mesh
        position={[beaconX, beaconY, PLANT_Z]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.022, 0.0036, 10, 24]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.electronGold}
          emissive={PROCESS_COLORS.electronGold}
          emissiveIntensity={beaconIntensity}
        />
      </mesh>
      {/* Well-separated adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[BURNER_X, 0.295, PLANT_Z + 0.02]}
      >
        <span>{parts.burner}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[CONVERTER_X, 0.5, PLANT_Z]}
      >
        <span>{parts.vanadiumBed}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[ABSORBER_X, 0.465, PLANT_Z]}
      >
        <span>{parts.absorptionTower}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[DILUTION_X, 0.372, PLANT_Z]}
      >
        <span>{parts.oleumTank}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[FLASK_X + 0.05, 0.235, PLANT_Z + 0.04]}
      >
        <span>{parts.acidPipe}</span>
      </ThreeLabel>
    </group>
  );
}
