import {
  useLeafTextures,
  useStemTextures,
} from "@repo/design-system/components/contents/biology/foliage";
import type { useHormoneBotanyGeometries } from "@repo/design-system/components/contents/biology/hormone/botany";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

const BUD_SCALE_RING = [0, 1.05, 2.1, 3.15, 4.2, 5.25] as const;
const PRIMORDIUM_RING = [0.4, 2.5, 4.6] as const;

export function ApicalBudCrown({
  auxinActive,
  geos,
  leafVariant,
  stemH,
}: {
  readonly auxinActive: boolean;
  readonly geos: ReturnType<typeof useHormoneBotanyGeometries>;
  readonly leafVariant: "chlorotic" | "healthy";
  readonly stemH: number;
}) {
  const leafTex = useLeafTextures(leafVariant);
  const sepalTex = useLeafTextures("sepal");

  return (
    <group position={[0, 0.03 + stemH, 0]}>
      {Arr.map(BUD_SCALE_RING, (yaw, idx) => (
        <mesh
          castShadow
          geometry={geos.budScale}
          key={`bs-${yaw}`}
          rotation={[0, yaw, 1.08 - (idx % 2) * 0.1]}
          scale={1.25}
        >
          <meshPhysicalMaterial
            bumpMap={sepalTex.bumpMap}
            bumpScale={0.012}
            color={
              auxinActive && idx % 2 === 0
                ? SPECIMEN_COLORS.auxinBudTint
                : SPECIMEN_COLORS.whiteTint
            }
            emissive={
              auxinActive
                ? SPECIMEN_COLORS.auxinBudEmissive
                : SPECIMEN_COLORS.noEmissive
            }
            emissiveIntensity={auxinActive ? 0.14 : 0}
            map={sepalTex.map}
            roughness={0.5}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {Arr.map(PRIMORDIUM_RING, (yaw) => (
        <mesh
          castShadow
          geometry={geos.primordium}
          key={`pr-${yaw}`}
          position={[0, 0.025, 0]}
          rotation={[0, yaw, 0.62]}
          scale={1.15}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.012}
            clearcoat={0.22}
            map={leafTex.map}
            roughness={0.48}
            roughnessMap={leafTex.roughnessMap}
            side={DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.036, 0]} scale={[0.75, 1.15, 0.75]}>
        <sphereGeometry args={[0.026, 16, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={
            auxinActive
              ? SPECIMEN_COLORS.auxinCore
              : SPECIMEN_COLORS.meristemCore
          }
          emissive={
            auxinActive
              ? SPECIMEN_COLORS.auxinCoreEmissive
              : SPECIMEN_COLORS.meristemEmissive
          }
          emissiveIntensity={auxinActive ? 0.38 : 0.05}
          roughness={0.38}
        />
      </mesh>
    </group>
  );
}

export function FoliageAndLateralShoot({
  geos,
  lateralBudScale,
  leafDroop,
  leafVariant,
  stemH,
}: {
  readonly geos: ReturnType<typeof useHormoneBotanyGeometries>;
  readonly lateralBudScale: number;
  readonly leafDroop: number;
  readonly leafVariant: "chlorotic" | "healthy";
  readonly stemH: number;
}) {
  const leafTex = useLeafTextures(leafVariant);
  const sepalTex = useLeafTextures("sepal");
  const stemTex = useStemTextures();

  return (
    <group>
      <group
        position={[0.02, 0.04 + stemH * 0.4, 0.008]}
        rotation={[0, -0.15, 0.18]}
        scale={lateralBudScale}
      >
        <mesh castShadow geometry={geos.lateralStem}>
          <meshPhysicalMaterial
            bumpMap={stemTex.bumpMap}
            bumpScale={0.01}
            map={stemTex.map}
            roughness={0.54}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.budScale}
          rotation={[0, 0.2, 0.85]}
          scale={0.62}
        >
          <meshPhysicalMaterial
            bumpMap={sepalTex.bumpMap}
            bumpScale={0.01}
            map={sepalTex.map}
            roughness={0.52}
            side={DoubleSide}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.lateralLeaflet}
          position={[0.095, 0.048, 0.008]}
          rotation={[0.05, 0.05, 0.25]}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.012}
            map={leafTex.map}
            roughness={0.48}
            side={DoubleSide}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.lateralLeaflet}
          position={[0.068, 0.036, 0.01]}
          rotation={[0.08, 0.72, 0.18]}
          scale={0.82}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.012}
            map={leafTex.map}
            roughness={0.48}
            side={DoubleSide}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.lateralLeaflet}
          position={[0.068, 0.036, -0.004]}
          rotation={[-0.08, -0.68, 0.18]}
          scale={0.82}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.012}
            map={leafTex.map}
            roughness={0.48}
            side={DoubleSide}
          />
        </mesh>
      </group>

      <group
        position={[-0.01, 0.04 + stemH * 0.68, 0]}
        rotation={[0, Math.PI * 0.96, -leafDroop * 0.78]}
      >
        <mesh castShadow geometry={geos.petiole}>
          <meshPhysicalMaterial
            bumpMap={stemTex.bumpMap}
            bumpScale={0.01}
            map={stemTex.map}
            roughness={0.54}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.leafBladeGeo}
          position={[0.105, 0.014, 0]}
          receiveShadow
          rotation={[0.1, 0, 0.06]}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.016}
            clearcoat={0.26}
            clearcoatRoughness={0.36}
            map={leafTex.map}
            roughness={0.52}
            roughnessMap={leafTex.roughnessMap}
            side={DoubleSide}
          />
        </mesh>
      </group>

      <group
        position={[-0.015, 0.04 + stemH * 0.39, 0.012]}
        rotation={[0, Math.PI * 0.74, -leafDroop * 0.62]}
        scale={0.84}
      >
        <mesh castShadow geometry={geos.petiole}>
          <meshPhysicalMaterial
            bumpMap={stemTex.bumpMap}
            bumpScale={0.01}
            map={stemTex.map}
            roughness={0.54}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.leafBladeGeo}
          position={[0.105, 0.014, 0]}
          receiveShadow
          rotation={[0.12, 0, 0.04]}
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.016}
            clearcoat={0.24}
            map={leafTex.map}
            roughness={0.54}
            roughnessMap={leafTex.roughnessMap}
            side={DoubleSide}
          />
        </mesh>
      </group>

      <group
        position={[0.01, 0.04 + stemH * 0.24, -0.014]}
        rotation={[0, -0.58, -leafDroop * 0.5]}
        scale={0.72}
      >
        <mesh castShadow geometry={geos.petiole}>
          <meshPhysicalMaterial
            bumpMap={stemTex.bumpMap}
            bumpScale={0.01}
            map={stemTex.map}
            roughness={0.54}
          />
        </mesh>
        <mesh
          castShadow
          geometry={geos.leafBladeGeo}
          position={[0.105, 0.014, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            bumpMap={leafTex.bumpMap}
            bumpScale={0.016}
            clearcoat={0.24}
            map={leafTex.map}
            roughness={0.54}
            roughnessMap={leafTex.roughnessMap}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
