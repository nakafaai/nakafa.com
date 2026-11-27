import type { useFlowerGeometries } from "@repo/design-system/components/contents/biology/flower/anatomy";
import {
  useLeafTextures,
  usePetalTextures,
  useStemTextures,
} from "@repo/design-system/components/contents/biology/foliage";
import { BotanicalPot } from "@repo/design-system/components/contents/biology/planter";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

const SEPAL_ANGLES = [0.25, 1.5, 2.75, 4.0, 5.25] as const;

const PETAL_FAN = [
  { id: "p0", pitch: 0.68, yaw: Math.PI * 0.9 },
  { id: "p1", pitch: 0.84, yaw: Math.PI * 0.7 },
  { id: "p2", pitch: 0.92, yaw: Math.PI * 0.5 },
  { id: "p3", pitch: 0.84, yaw: Math.PI * 0.3 },
  { id: "p4", pitch: 0.68, yaw: Math.PI * 0.1 },
] as const;

const OVULE_SLOTS = [
  { id: "ov1", pos: [0, 0.76, 0.032] as const },
  { id: "ov2", pos: [-0.052, 0.84, 0.026] as const },
  { id: "ov3", pos: [0.052, 0.84, 0.026] as const },
] as const;

const STIGMA_LOBES = [
  {
    id: "sl0",
    pos: [-0.032, 0.006, 0.008] as const,
    rot: [0.18, 0.3, 0.42] as const,
  },
  {
    id: "sl1",
    pos: [0.032, 0.006, 0.008] as const,
    rot: [0.18, -0.3, -0.42] as const,
  },
  { id: "sl2", pos: [0, 0.012, -0.028] as const, rot: [-0.36, 0, 0] as const },
] as const;

const STIGMA_DUST = [
  { id: "sd1", pos: [-0.034, 0.034, 0.016] as const },
  { id: "sd2", pos: [0.028, 0.032, 0.018] as const },
  { id: "sd3", pos: [0.004, 0.038, -0.016] as const },
  { id: "sd4", pos: [-0.012, 0.03, 0.028] as const },
  { id: "sd5", pos: [0.016, 0.036, 0.004] as const },
] as const;

export function FlowerPerianth({
  geos,
  petalVariant,
}: {
  readonly geos: ReturnType<typeof useFlowerGeometries>;
  readonly petalVariant: "rose" | "wind";
}) {
  const sepalTex = useLeafTextures("sepal");
  const leafTex = useLeafTextures("healthy");
  const petalTex = usePetalTextures(petalVariant);
  const stemTex = useStemTextures();

  return (
    <group>
      <BotanicalPot
        bottomRadius={0.2}
        height={0.25}
        mossy
        seed={23}
        topRadius={0.26}
      />
      <mesh castShadow geometry={geos.pedicel} receiveShadow>
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.012}
          map={stemTex.map}
          roughness={0.54}
        />
      </mesh>
      <mesh
        castShadow
        geometry={geos.basalLeaf}
        position={[-0.02, 0.36, 0.01]}
        receiveShadow
        rotation={[0.08, 2.75, 0.22]}
      >
        <meshPhysicalMaterial
          bumpMap={leafTex.bumpMap}
          bumpScale={0.012}
          clearcoat={0.22}
          map={leafTex.map}
          roughness={0.52}
          roughnessMap={leafTex.roughnessMap}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        castShadow
        geometry={geos.basalLeaf}
        position={[0.02, 0.34, -0.02]}
        receiveShadow
        rotation={[0.1, -0.35, 0.25]}
        scale={0.88}
      >
        <meshPhysicalMaterial
          bumpMap={leafTex.bumpMap}
          bumpScale={0.012}
          clearcoat={0.22}
          map={leafTex.map}
          roughness={0.52}
          roughnessMap={leafTex.roughnessMap}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        castShadow
        geometry={geos.receptacle}
        position={[0, 0.64, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.012}
          map={stemTex.map}
          roughness={0.52}
        />
      </mesh>
      <group position={[0, 0.66, 0]}>
        {Arr.map(SEPAL_ANGLES, (yaw) => (
          <mesh
            castShadow
            geometry={geos.sepal}
            key={`sep-${yaw}`}
            receiveShadow
            rotation={[0, yaw, -0.08]}
          >
            <meshPhysicalMaterial
              bumpMap={sepalTex.bumpMap}
              bumpScale={0.014}
              clearcoat={0.24}
              map={sepalTex.map}
              roughness={0.52}
              roughnessMap={sepalTex.roughnessMap}
              side={DoubleSide}
            />
          </mesh>
        ))}
      </group>
      <group position={[0, 0.67, -0.04]}>
        {Arr.map(PETAL_FAN, (p) => (
          <mesh
            castShadow
            geometry={geos.petal}
            key={p.id}
            receiveShadow
            rotation={[0, p.yaw, p.pitch]}
          >
            <meshPhysicalMaterial
              bumpMap={petalTex.bumpMap}
              bumpScale={0.01}
              clearcoat={0.18}
              clearcoatRoughness={0.42}
              map={petalTex.map}
              roughness={0.46}
              side={DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function FlowerCarpelAndStamens({
  geos,
  windPollinated,
}: {
  readonly geos: ReturnType<typeof useFlowerGeometries>;
  readonly windPollinated: boolean;
}) {
  const stemTex = useStemTextures();

  return (
    <group>
      <mesh
        castShadow
        geometry={geos.ovaryShell}
        position={[0, 0.65, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.01}
          clearcoat={0.38}
          color={SPECIMEN_COLORS.ovarySage}
          roughness={0.44}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={geos.loculeCore} position={[0, 0.65, 0]}>
        <meshStandardMaterial
          color={SPECIMEN_COLORS.loculeCream}
          roughness={0.62}
          side={DoubleSide}
        />
      </mesh>
      {Arr.map(OVULE_SLOTS, (ov) => (
        <mesh
          castShadow
          key={ov.id}
          position={[ov.pos[0], ov.pos[1], ov.pos[2]]}
          scale={[0.88, 1.18, 0.88]}
        >
          <sphereGeometry args={[0.042, 18, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.68}
            clearcoatRoughness={0.22}
            color={SPECIMEN_COLORS.ovulePearl}
            roughness={0.26}
          />
        </mesh>
      ))}
      <mesh geometry={geos.pollenTube}>
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={SPECIMEN_COLORS.pollenTubeGold}
          emissive={SPECIMEN_COLORS.pollenTubeEmissive}
          emissiveIntensity={0.22}
          opacity={0.86}
          roughness={0.28}
          transparent
        />
      </mesh>
      <mesh castShadow geometry={geos.style} receiveShadow>
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.008}
          color={SPECIMEN_COLORS.styleGreen}
          roughness={0.46}
        />
      </mesh>
      <group position={[0, 1.33, 0]}>
        {windPollinated ? (
          Arr.map(geos.plumoseBranches, (br) => (
            <mesh castShadow geometry={br.geo} key={br.id}>
              <meshPhysicalMaterial
                clearcoat={0.18}
                color={SPECIMEN_COLORS.plumoseCream}
                roughness={0.62}
              />
            </mesh>
          ))
        ) : (
          <group>
            {Arr.map(STIGMA_LOBES, (lobe) => (
              <mesh
                castShadow
                geometry={geos.stigmaLobe}
                key={lobe.id}
                position={[lobe.pos[0], lobe.pos[1], lobe.pos[2]]}
                rotation={[lobe.rot[0], lobe.rot[1], lobe.rot[2]]}
              >
                <meshPhysicalMaterial
                  clearcoat={0.55}
                  clearcoatRoughness={0.3}
                  color={SPECIMEN_COLORS.stigmaRose}
                  roughness={0.44}
                />
              </mesh>
            ))}
            {Arr.map(STIGMA_DUST, (dot) => (
              <mesh
                geometry={geos.pollenGrain}
                key={dot.id}
                position={[dot.pos[0], dot.pos[1], dot.pos[2]]}
                scale={0.011}
              >
                <meshStandardMaterial
                  color={SPECIMEN_COLORS.pollenDust}
                  roughness={0.58}
                />
              </mesh>
            ))}
          </group>
        )}
      </group>
      {Arr.map(geos.stamens, (stamen) => (
        <group key={stamen.id}>
          <mesh castShadow geometry={stamen.filament}>
            <meshPhysicalMaterial
              clearcoat={0.22}
              color={SPECIMEN_COLORS.filamentCream}
              roughness={0.48}
            />
          </mesh>
          <group
            position={[stamen.tip[0], stamen.tip[1], stamen.tip[2]]}
            rotation={[0, 0, stamen.tiltZ]}
          >
            <mesh
              castShadow
              geometry={geos.antherTheca}
              position={[-0.017, 0, 0]}
            >
              <meshPhysicalMaterial
                clearcoat={0.22}
                color={SPECIMEN_COLORS.antherGold}
                roughness={0.54}
              />
            </mesh>
            <mesh
              castShadow
              geometry={geos.antherTheca}
              position={[0.017, 0, 0]}
            >
              <meshPhysicalMaterial
                clearcoat={0.22}
                color={SPECIMEN_COLORS.antherGold}
                roughness={0.54}
              />
            </mesh>
            <mesh position={[0, -0.01, -0.008]}>
              <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
              <meshStandardMaterial
                color={SPECIMEN_COLORS.antherConnective}
                roughness={0.62}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
