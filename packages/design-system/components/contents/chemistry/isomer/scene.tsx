import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  BROMINE_ORIGIN,
  createBromineDropGeometry,
  MODEL_ORIGIN,
} from "@repo/design-system/components/contents/chemistry/isomer/geometry";
import type { IsomerCompound } from "@repo/design-system/components/contents/chemistry/isomer/model";
import { evaluateIsomerGeometry } from "@repo/design-system/components/contents/chemistry/isomer/model";
import {
  BromineStation,
  MoleculeModel,
  SpecimenPlinth,
} from "@repo/design-system/components/contents/chemistry/isomer/parts";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh, MeshPhysicalMaterial } from "three";

const DROP_START_Y = 0.188;
const LIQUID_TOP_Y = 0.106;

function IsomerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.02, 0.27, 0.84] : [0.02, 0.22, 0.65]}
      cameraTarget={[0.02, 0.135, 0.01]}
      fov={37}
      maxDistance={1.5}
      minDistance={0.3}
    />
  );
}

export function AlkaneAlkeneScene({
  compound,
  parts,
}: {
  readonly compound: IsomerCompound;
  readonly parts: Readonly<
    Record<
      | "bromineDrop"
      | "carbonAtom"
      | "doubleBond"
      | "hydrogenAtom"
      | "singleBond",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const labelInk = useLabelInk();
  const molRef = useRef<Group>(null);
  const dropRef = useRef<Mesh>(null);
  const dropMatRef = useRef<MeshPhysicalMaterial>(null);
  const rippleRef = useRef<Mesh>(null);
  const phaseRef = useRef(0);

  const geom = evaluateIsomerGeometry(compound);
  const dropGeo = useMemo(createBromineDropGeometry, []);
  useEffect(() => () => dropGeo.dispose(), [dropGeo]);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (molRef.current !== null) {
      molRef.current.rotation.y = 0;
    }
    if (dropRef.current !== null) {
      dropRef.current.position.set(
        BROMINE_ORIGIN[0],
        DROP_START_Y,
        BROMINE_ORIGIN[2]
      );
      dropRef.current.scale.set(1, 1, 1);
    }
    if (dropMatRef.current !== null) {
      dropMatRef.current.opacity = 0.92;
    }
    if (rippleRef.current !== null) {
      rippleRef.current.scale.set(0.01, 0.01, 0.01);
      rippleRef.current.visible = false;
    }
    invalidate();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.78;
    const t = phaseRef.current;

    if (molRef.current !== null) {
      molRef.current.rotation.y = Math.sin(t) * 0.34;
    }

    const cycle = (t * 0.9) % 1;
    if (dropRef.current !== null && dropMatRef.current !== null) {
      if (cycle < 0.76) {
        const fall = (cycle / 0.76) ** 1.65;
        dropRef.current.position.set(
          BROMINE_ORIGIN[0],
          DROP_START_Y - fall * (DROP_START_Y - LIQUID_TOP_Y),
          BROMINE_ORIGIN[2]
        );
        dropRef.current.scale.set(1, 1 + fall * 0.18, 1);
        // Decolourise droplet as it contacts the clear alkene solution
        dropMatRef.current.opacity =
          geom.unsaturated && fall > 0.72
            ? Math.max(0.15, 0.92 - ((fall - 0.72) / 0.28) * 0.77)
            : 0.92;
      } else {
        dropRef.current.position.set(
          BROMINE_ORIGIN[0],
          DROP_START_Y,
          BROMINE_ORIGIN[2]
        );
        const swell = (cycle - 0.76) / 0.24;
        dropRef.current.scale.setScalar(0.35 + swell * 0.65);
        dropMatRef.current.opacity = 0.92;
      }
    }

    if (rippleRef.current !== null) {
      if (cycle >= 0.72) {
        const wave = (cycle - 0.72) / 0.28;
        rippleRef.current.visible = true;
        const s = 0.25 + wave * 1.1;
        rippleRef.current.scale.set(s, s, 1);
      } else {
        rippleRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <IsomerCamera />
      <LabBench width={2.6} />

      <SpecimenPlinth />
      <group position={MODEL_ORIGIN} ref={molRef}>
        <MoleculeModel compound={compound} />
      </group>

      <BromineStation unsaturated={geom.unsaturated} />

      {/* Animated reddish-brown bromine teardrop and surface ripple */}
      <mesh
        geometry={dropGeo}
        position={[BROMINE_ORIGIN[0], DROP_START_Y, BROMINE_ORIGIN[2]]}
        ref={dropRef}
      >
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={ORGANIC_COLORS.bromineBrown}
          opacity={0.92}
          ref={dropMatRef}
          roughness={0.14}
          transparent
        />
      </mesh>
      <mesh
        position={[BROMINE_ORIGIN[0], LIQUID_TOP_Y + 0.001, BROMINE_ORIGIN[2]]}
        ref={rippleRef}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.01, 0.01, 0.01]}
        visible={false}
      >
        <torusGeometry args={[0.009, 0.0008, 8, 24]} />
        <GlassMaterial color={BENCH_COLORS.streamGlint} opacity={0.7} />
      </mesh>

      {/* Clean adaptive-ink labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.175, 0.215, 0.02]}
      >
        <span>{parts.carbonAtom}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.045, 0.245, 0.02]}
      >
        <span>{parts.hydrogenAtom}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.055, 0.042, 0.095]}
      >
        <span>{geom.unsaturated ? parts.doubleBond : parts.singleBond}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[BROMINE_ORIGIN[0], 0.295, BROMINE_ORIGIN[2]]}
      >
        <span>{parts.bromineDrop}</span>
      </ThreeLabel>
    </group>
  );
}
