import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  useFruitTextures,
  useLeafTextures,
  useStemTextures,
} from "@repo/design-system/components/contents/biology/foliage";
import { useHormoneBotanyGeometries } from "@repo/design-system/components/contents/biology/hormone/botany";
import type { PhytohormoneId } from "@repo/design-system/components/contents/biology/hormone/model";
import { evaluatePhytohormone } from "@repo/design-system/components/contents/biology/hormone/model";
import {
  ApicalBudCrown,
  FoliageAndLateralShoot,
} from "@repo/design-system/components/contents/biology/hormone/shoots";
import { OrganicSoilBed } from "@repo/design-system/components/contents/biology/planter";
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
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

const CALYX_STAR = [0, 1.26, 2.51, 3.77, 5.03] as const;

const ETHYLENE_PUFFS = [
  { id: "e1", pos: [0.16, 0.08, 0.08] as const },
  { id: "e2", pos: [-0.14, 0.12, 0.06] as const },
  { id: "e3", pos: [0.06, 0.16, -0.06] as const },
] as const;

function HormoneCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.48, 3.45] : [0, 1.24, 2.86]}
      cameraTarget={[0, 0.64, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function PhytohormoneScene({
  hormone,
  parts,
}: {
  readonly hormone: PhytohormoneId;
  readonly parts: Readonly<
    Record<"fruit" | "lateralBud" | "leaf" | "shootTip" | "stemNode", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const pulseRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const morph = evaluatePhytohormone(hormone);

  const resetPulse = () => {
    phaseRef.current = 0;
    if (pulseRef.current !== null) {
      pulseRef.current.scale.setScalar(1);
    }
  };

  useVisualStop(resetPulse);
  useVisualReset(resetPulse);

  useFrame((_, delta) => {
    if (!playing || pulseRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.1;
    const s = 1 + Math.sin(phaseRef.current) * 0.045;
    pulseRef.current.scale.set(s, s, s);
  });

  const stemH = 0.88 * morph.stemScale;
  const geos = useHormoneBotanyGeometries(stemH);
  const stemTex = useStemTextures();
  const sepalTex = useLeafTextures("sepal");
  const fruitTex = useFruitTextures(morph.fruitRipeness);
  const leafVariant = hormone === "abscisicAcid" ? "chlorotic" : "healthy";

  return (
    <group>
      <SimulationTicker running={playing} />
      <HormoneCamera />

      <OrganicSoilBed
        innerRadius={0.62}
        moundHeight={0.095}
        moundRadius={0.44}
        outerRadius={1.65}
        seed={31}
      />

      <mesh castShadow geometry={geos.stem} receiveShadow>
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.008}
          map={stemTex.map}
          roughness={0.56}
        />
      </mesh>

      <ApicalBudCrown
        auxinActive={hormone === "auxin"}
        geos={geos}
        leafVariant={leafVariant}
        stemH={stemH}
      />

      <FoliageAndLateralShoot
        geos={geos}
        lateralBudScale={morph.lateralBudScale}
        leafDroop={morph.leafDroop}
        leafVariant={leafVariant}
        stemH={stemH}
      />

      <mesh castShadow geometry={geos.pedicel}>
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.01}
          map={stemTex.map}
          roughness={0.54}
        />
      </mesh>
      <group position={[0.26, -0.045 + stemH * 0.66, 0.085]} ref={pulseRef}>
        <mesh castShadow geometry={geos.fruit} receiveShadow>
          <meshPhysicalMaterial
            bumpMap={fruitTex.bumpMap}
            bumpScale={0.008}
            clearcoat={0.78}
            clearcoatRoughness={0.16}
            map={fruitTex.map}
            roughness={0.28}
          />
        </mesh>
        <group position={[0, 0.095, 0]}>
          {Arr.map(CALYX_STAR, (yaw) => (
            <mesh
              castShadow
              geometry={geos.calyxSepal}
              key={`cs-${yaw}`}
              rotation={[0, yaw, -0.18]}
            >
              <meshPhysicalMaterial
                bumpMap={sepalTex.bumpMap}
                bumpScale={0.01}
                map={sepalTex.map}
                roughness={0.54}
                side={DoubleSide}
              />
            </mesh>
          ))}
        </group>
        {hormone === "ethylene"
          ? Arr.map(ETHYLENE_PUFFS, (puff) => (
              <mesh
                key={puff.id}
                position={[puff.pos[0], puff.pos[1], puff.pos[2]]}
              >
                <sphereGeometry args={[0.028, 12, 10]} />
                <meshPhysicalMaterial
                  color={SPECIMEN_COLORS.ethyleneGas}
                  depthWrite={false}
                  emissive={SPECIMEN_COLORS.ethyleneEmissive}
                  emissiveIntensity={0.32}
                  opacity={0.4}
                  roughness={0.24}
                  transparent
                />
              </mesh>
            ))
          : null}
      </group>

      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0, 0.28 + stemH, 0]}
      >
        <span>{parts.shootTip}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0.76, 0.04 + stemH * 0.66, 0]}
      >
        <span>{parts.fruit}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0.76, 0.04 + stemH * 0.36, 0]}
      >
        <span>{parts.lateralBud}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.78, 0.06 + stemH * 0.72, 0]}
      >
        <span>{parts.leaf}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.76, 0.04 + stemH * 0.35, 0]}
      >
        <span>{parts.stemNode}</span>
      </ThreeLabel>
    </group>
  );
}
