"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import {
  BLUE_MARBLE_EARTH_TEXTURE_ASSET,
  TERRA_SATELLITE_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import type {
  BiologyLabProps,
  BiologySceneColors,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  FloatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { useMemo } from "react";
import {
  Box3,
  type Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

const CLIMATE_OBSERVATION_VIEW = {
  cameraPosition: [2.55, 1.58, 3.48],
  cameraTarget: [0.02, 0.12, 0.02],
  narrowCameraPosition: [3.18, 2.02, 4.2],
} satisfies BiologySceneView;

export function ClimateObservationLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={ClimateObservationScene}
      view={CLIMATE_OBSERVATION_VIEW}
      {...props}
    />
  );
}

function ClimateObservationScene({ colors }: BiologySceneProps) {
  return (
    <group position={[0, -0.04, 0]} rotation={[-0.08, -0.3, 0.02]} scale={1.2}>
      <EarthIndicators />
      <SensorSwath color={colors.ice} />

      <FloatingGroup speed={0.72} travel={0.035}>
        <group position={[0.96, 1.18, 0.58]} rotation={[0.12, -0.58, 0.08]}>
          <TerraSatelliteModel colors={colors} />
        </group>
      </FloatingGroup>
    </group>
  );
}

function EarthIndicators() {
  const earthTexture = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  earthTexture.colorSpace = SRGBColorSpace;

  return (
    <group>
      <mesh rotation={[0.08, -1.35, 0]} scale={[0.96, 0.94, 0.96]}>
        <sphereGeometry args={[1, 96, 48]} />
        <meshBasicMaterial map={earthTexture} />
      </mesh>
    </group>
  );
}

function SensorSwath({ color }: { color: string }) {
  return (
    <group>
      <BiologyLine
        color={color}
        lineWidth={1}
        points={[
          [0.82, 1.02, 0.48],
          [0.26, 0.3, 0.9],
        ]}
      />
      <BiologyLine
        color={color}
        lineWidth={1}
        points={[
          [0.82, 1.02, 0.48],
          [-0.18, 0.58, 0.78],
        ]}
      />
    </group>
  );
}

function TerraSatelliteModel({ colors }: { colors: BiologySceneColors }) {
  const { scene } = useGLTF(TERRA_SATELLITE_ASSET.path);
  const satellite = useMemo(
    () => prepareSatelliteScene(scene, colors),
    [scene, colors]
  );

  return <primitive object={satellite} />;
}

function prepareSatelliteScene(source: Group, colors: BiologySceneColors) {
  const satellite = source.clone(true);
  const bounds = new Box3().setFromObject(satellite);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = 0.95 / Math.max(size.x, size.y, size.z);

  satellite.scale.setScalar(scale);
  satellite.position.set(
    -center.x * scale,
    -center.y * scale,
    -center.z * scale
  );

  satellite.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.geometry.computeVertexNormals();
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = createSatelliteMaterial(child.material, colors);
  });

  return satellite;
}

function createSatelliteMaterial(
  material: Material | Material[],
  colors: BiologySceneColors
) {
  const baseMaterial = Array.isArray(material) ? material[0] : material;
  const materialName = baseMaterial?.name.toLowerCase() ?? "";

  if (materialName.includes("panel")) {
    return new MeshStandardMaterial({
      color: colors.ocean,
      emissive: colors.ocean,
      emissiveIntensity: 0.06,
      roughness: 0.72,
    });
  }

  if (materialName.includes("gold")) {
    return new MeshStandardMaterial({
      color: colors.animal,
      metalness: 0.18,
      roughness: 0.58,
    });
  }

  return new MeshStandardMaterial({
    color: materialName.includes("thruster") ? colors.text : colors.muted,
    metalness: 0.08,
    roughness: 0.66,
  });
}

useGLTF.preload(TERRA_SATELLITE_ASSET.path);
useTexture.preload(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
