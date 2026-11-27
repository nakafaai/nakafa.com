import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useStomataGeometries } from "@repo/design-system/components/contents/biology/stomata/anatomy";
import type { StomataReading } from "@repo/design-system/components/contents/biology/stomata/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const ION_SLOTS = [
  { id: "i1", side: -1, z: -0.22 },
  { id: "i2", side: 1, z: -0.22 },
  { id: "i3", side: -1, z: 0.22 },
  { id: "i4", side: 1, z: 0.22 },
] as const;

function StomataCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.38, 2.75] : [0, 1.98, 2.28]}
      cameraTarget={[0, 0.22, 0]}
      fov={38}
      maxDistance={5.2}
      minDistance={1.2}
    />
  );
}

export function StomataScene({
  parts,
  reading,
}: {
  readonly parts: Readonly<
    Record<
      | "chloroplast"
      | "guardCell"
      | "pore"
      | "potassiumIon"
      | "thickInnerWall"
      | "thinOuterWall"
      | "vacuole"
      | "water",
      string
    >
  >;
  readonly reading: StomataReading;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const { dynamicGeos, staticGeos } = useStomataGeometries(
    reading.openFraction
  );
  const complexRef = useRef<Group>(null);
  const ionsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useVisualStop(() => {
    phaseRef.current = 0;
    if (complexRef.current !== null) {
      complexRef.current.scale.set(1, 1, 1);
    }
    if (ionsRef.current !== null) {
      ionsRef.current.position.y = 0.26;
    }
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.1;
    const breath = 1 + Math.sin(phaseRef.current) * 0.018;
    if (complexRef.current !== null) {
      complexRef.current.scale.set(breath, 1, 1);
    }
    if (ionsRef.current !== null) {
      ionsRef.current.position.y =
        0.26 + Math.sin(phaseRef.current * 1.4) * 0.036;
    }
  });

  const ionDist = reading.turgor === "turgid" ? 0.44 : 0.92;

  return (
    <group>
      <SimulationTicker running={playing} />
      <StomataCamera />

      {/* Lower spongy mesophyll substomatal chamber floor */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[1.26, 1.32, 0.05, 36]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.lumenVoid}
          roughness={0.92}
        />
      </mesh>

      {/* Interlocking jigsaw epidermal pavement cells with waxy cuticle sheen */}
      <group position={[0, 0.04, 0]}>
        {Arr.map(staticGeos.pavementCells, (cell, idx) => (
          <mesh castShadow geometry={cell.geo} key={cell.id} receiveShadow>
            <meshPhysicalMaterial
              clearcoat={0.34}
              clearcoatRoughness={0.28}
              color={
                idx % 2 === 0
                  ? FOLIAGE_COLORS.epidermis
                  : FOLIAGE_COLORS.cuticle
              }
              roughness={0.54}
            />
          </mesh>
        ))}
      </group>

      {/* Almond/lens-shaped sunken stomatal pore */}
      <mesh geometry={dynamicGeos.poreVoid} position={[0, 0.055, 0]}>
        <meshStandardMaterial
          color={FOLIAGE_COLORS.lumenVoid}
          roughness={0.95}
        />
      </mesh>

      {/* Paired dynamic crescent guard cells (left & right) */}
      <group position={[0, 0.21, 0]} ref={complexRef}>
        {/* Smooth fused polar junction caps closing both stomatal ends */}
        {Arr.map([-0.44, 0.44] as const, (poleZ) => (
          <mesh
            castShadow
            key={`pole-${poleZ}`}
            position={[0, 0.0, poleZ]}
            scale={[1.45, 0.85, 0.95]}
          >
            <sphereGeometry args={[0.095, 18, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.48}
              clearcoatRoughness={0.22}
              color={FOLIAGE_COLORS.guardWallOuter}
              roughness={0.34}
            />
          </mesh>
        ))}
        {Arr.map(
          [
            { data: dynamicGeos.left, id: "gc-left" },
            { data: dynamicGeos.right, id: "gc-right" },
          ],
          (side) => (
            <group key={side.id}>
              {/* Translucent thin outer wall */}
              <mesh castShadow geometry={side.data.outerTube} receiveShadow>
                <meshPhysicalMaterial
                  clearcoat={0.48}
                  clearcoatRoughness={0.22}
                  color={FOLIAGE_COLORS.guardWallOuter}
                  opacity={0.72}
                  roughness={0.32}
                  transparent
                />
              </mesh>
              {/* Thickened dark-emerald inner pore-facing wall */}
              <mesh castShadow geometry={side.data.innerWall}>
                <meshPhysicalMaterial
                  clearcoat={0.36}
                  color={FOLIAGE_COLORS.guardWallInner}
                  roughness={0.36}
                />
              </mesh>
              {/* Swelling curved central vacuole */}
              <mesh geometry={side.data.vacuoleTube}>
                <meshPhysicalMaterial
                  clearcoat={0.7}
                  color={FOLIAGE_COLORS.vacuole}
                  opacity={0.68}
                  roughness={0.18}
                  transparent
                />
              </mesh>
              {/* Radial cellulose microfibril hoops */}
              {Arr.map(side.data.microfibrils, (mf) => (
                <mesh
                  key={mf.id}
                  position={[mf.pos[0], mf.pos[1], mf.pos[2]]}
                  rotation={[0, mf.yaw, 0]}
                  scale={[1, 0.78, 1]}
                >
                  <torusGeometry args={[mf.r, 0.008, 8, 22]} />
                  <meshStandardMaterial
                    color={FOLIAGE_COLORS.cuticle}
                    roughness={0.46}
                  />
                </mesh>
              ))}
              {/* Biconvex discoid chloroplasts */}
              {Arr.map(side.data.chloroplasts, (chl) => (
                <mesh
                  key={chl.id}
                  position={[chl.pos[0], chl.pos[1], chl.pos[2]]}
                  scale={[1.25, 0.52, 1.0]}
                >
                  <sphereGeometry args={[0.036, 12, 10]} />
                  <meshPhysicalMaterial
                    clearcoat={0.4}
                    color={FOLIAGE_COLORS.chloroplast}
                    roughness={0.34}
                  />
                </mesh>
              ))}
            </group>
          )
        )}
      </group>

      {/* Potassium ions & water molecules migrating with turgor */}
      <group position={[0, 0.26, 0]} ref={ionsRef}>
        {Arr.map(ION_SLOTS, (slot) => (
          <group key={slot.id}>
            <mesh position={[slot.side * ionDist, 0.14, slot.z]}>
              <icosahedronGeometry args={[0.038, 1]} />
              <meshPhysicalMaterial
                clearcoat={0.65}
                color={FOLIAGE_COLORS.potassiumIon}
                emissive={FOLIAGE_COLORS.potassiumIon}
                emissiveIntensity={0.22}
                roughness={0.22}
              />
            </mesh>
            <mesh position={[slot.side * (ionDist + 0.14), 0.1, slot.z * 0.5]}>
              <sphereGeometry args={[0.038, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.9}
                color={FOLIAGE_COLORS.waterMolecule}
                ior={1.33}
                opacity={0.84}
                roughness={0.1}
                transparent
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* High-contrast adaptive callouts */}
      <ThreeLabel color={labelInk} fontSize="compact" position={[0, 0.62, 0]}>
        <span>{parts.pore}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.92, 0.44, -0.46]}
      >
        <span>{parts.guardCell}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.92, 0.44, -0.46]}
      >
        <span>{parts.thinOuterWall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.46, -0.82]}
      >
        <span>{parts.thickInnerWall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.88, 0.42, 0.54]}
      >
        <span>{parts.vacuole}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.88, 0.42, 0.54]}
      >
        <span>
          {parts.potassiumIon} / {parts.water}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0, 0.42, 0.92]}
      >
        <span>{parts.chloroplast}</span>
      </ThreeLabel>
    </group>
  );
}
