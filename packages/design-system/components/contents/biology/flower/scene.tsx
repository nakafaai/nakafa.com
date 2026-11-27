import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useFlowerGeometries } from "@repo/design-system/components/contents/biology/flower/anatomy";
import type { PollinationMode } from "@repo/design-system/components/contents/biology/flower/model";
import { evaluatePollinationTraits } from "@repo/design-system/components/contents/biology/flower/model";
import {
  FlowerCarpelAndStamens,
  FlowerPerianth,
} from "@repo/design-system/components/contents/biology/flower/whorls";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { useRef } from "react";
import type { Group } from "three";

const POLLEN_HOME = [0.22, 1.28, 0.14] as const;

function FlowerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.72, 3.65] : [0, 1.48, 3.1]}
      cameraTarget={[0, 0.88, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.5}
    />
  );
}

export function FlowerAnatomyScene({
  mode,
  parts,
}: {
  readonly mode: PollinationMode;
  readonly parts: Readonly<
    Record<
      | "anther"
      | "filament"
      | "ovary"
      | "ovule"
      | "petal"
      | "sepal"
      | "stigma"
      | "style",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const pollenRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const traits = evaluatePollinationTraits(mode);
  const geos = useFlowerGeometries(
    mode,
    traits.petalScale,
    traits.filamentLength
  );

  const resetPollen = () => {
    phaseRef.current = 0;
    if (pollenRef.current !== null) {
      pollenRef.current.position.set(
        POLLEN_HOME[0],
        POLLEN_HOME[1],
        POLLEN_HOME[2]
      );
    }
  };

  useVisualStop(resetPollen);
  useVisualReset(resetPollen);

  useFrame((_, delta) => {
    if (!playing || pollenRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (mode === "wind" ? 1.5 : 0.85);
    const t = phaseRef.current % 1;
    pollenRef.current.position.set(
      0.32 - t * 0.62,
      1.28 + Math.sin(t * Math.PI) * 0.14,
      0.14
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <FlowerCamera />
      <FlowerPerianth
        geos={geos}
        petalVariant={mode === "insect" ? "rose" : "wind"}
      />
      <FlowerCarpelAndStamens geos={geos} windPollinated={mode === "wind"} />

      <group
        position={[POLLEN_HOME[0], POLLEN_HOME[1], POLLEN_HOME[2]]}
        ref={pollenRef}
      >
        <mesh
          castShadow
          geometry={geos.pollenGrain}
          scale={traits.pollenSize * 0.72}
        >
          <meshPhysicalMaterial
            clearcoat={0.25}
            color={SPECIMEN_COLORS.pollenGrain}
            emissive={SPECIMEN_COLORS.pollenEmissive}
            emissiveIntensity={0.14}
            roughness={0.48}
          />
        </mesh>
        <mesh
          geometry={geos.pollenGrain}
          position={[-0.052, 0.036, -0.025]}
          scale={traits.pollenSize * 0.48}
        >
          <meshStandardMaterial
            color={SPECIMEN_COLORS.pollenMinor}
            roughness={0.56}
          />
        </mesh>
        {mode === "wind" ? (
          <mesh
            geometry={geos.pollenGrain}
            position={[0.058, -0.028, 0.022]}
            scale={traits.pollenSize * 0.44}
          >
            <meshStandardMaterial
              color={SPECIMEN_COLORS.pollenMinor}
              roughness={0.56}
            />
          </mesh>
        ) : null}
      </group>

      <ThreeLabel color={ink} fontSize="compact" position={[0, 1.54, 0]}>
        <span>{parts.stigma}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.86, 1.24, 0]}>
        <span>{parts.petal}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.84, 1.32, 0]}>
        <span>{parts.anther}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.84, 0.96, 0]}>
        <span>{parts.filament}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.84, 0.92, 0]}>
        <span>{parts.style}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.84, 0.64, 0]}>
        <span>
          {parts.ovary} / {parts.ovule}
        </span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.82, 0.56, 0]}>
        <span>{parts.sepal}</span>
      </ThreeLabel>
    </group>
  );
}
