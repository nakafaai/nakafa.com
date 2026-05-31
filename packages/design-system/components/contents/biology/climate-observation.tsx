"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import {
  BLUE_MARBLE_EARTH_TEXTURE_ASSET,
  TERRA_SATELLITE_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
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
  RotatingGroup,
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
  cameraPosition: [2.55, 1.82, 3.45],
  cameraTarget: [0, 0.28, 0],
  maxAzimuthAngle: Math.PI / 18,
  maxPolarAngle: Math.PI / 2.45,
  minAzimuthAngle: -Math.PI / 18,
  minPolarAngle: Math.PI / 3.05,
  narrowCameraPosition: [3.05, 2.28, 4.35],
} satisfies BiologySceneView;

const CALLOUT_TARGETS = [
  {
    fontSize: 0.12,
    id: "satellite",
    labelPosition: [-1.42, 1.38, 1.12],
    target: [-0.18, 1.18, 0.24],
  },
  {
    fontSize: 0.13,
    id: "ocean",
    labelPosition: [-1.42, -0.28, 1.1],
    target: [-0.5, -0.28, 0.86],
  },
  {
    fontSize: 0.11,
    id: "ice",
    labelPosition: [-1.24, 0.78, 1.08],
    target: [-0.08, 0.78, 0.58],
  },
  {
    fontSize: 0.11,
    id: "land",
    labelPosition: [1.38, -0.18, 1.08],
    target: [0.28, 0.08, 0.86],
  },
] as const;

const SENSOR_LINES = [
  {
    id: "ocean",
    points: [
      [0, 1.07, 0],
      [-0.62, -0.2, 0.66],
    ],
  },
  {
    id: "ice",
    points: [
      [0, 1.07, 0],
      [-0.22, 0.72, 0.64],
    ],
  },
  {
    id: "land",
    points: [
      [0, 1.07, 0],
      [0.12, -0.08, 0.78],
    ],
  },
] as const;

export function ClimateObservationLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={ClimateObservationScene}
      view={CLIMATE_OBSERVATION_VIEW}
      {...props}
    />
  );
}

function ClimateObservationScene({ colors, item }: BiologySceneProps) {
  return (
    <group position={[0, 0.2, 0]} rotation={[-0.08, -0.3, 0.02]} scale={1.08}>
      <EarthIndicators colors={colors} />
      <SensorSwath color={colors.ice} />

      <FloatingGroup speed={0.72} travel={0.035}>
        <group position={[0, 1.18, 0]} rotation={[0.12, -0.38, 0.08]}>
          <RotatingGroup speed={0.08}>
            <TerraSatelliteModel colors={colors} />
          </RotatingGroup>
        </group>
      </FloatingGroup>

      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={CALLOUT_TARGETS}
      />
    </group>
  );
}

function EarthIndicators({ colors }: { colors: BiologySceneColors }) {
  const earthTexture = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  earthTexture.colorSpace = SRGBColorSpace;

  return (
    <group>
      <mesh rotation={[0.08, -1.35, 0]} scale={[0.96, 0.94, 0.96]}>
        <sphereGeometry args={[1, 96, 48]} />
        <meshBasicMaterial map={earthTexture} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.05]}>
        <torusGeometry args={[1.12, 0.005, 8, 96]} />
        <meshStandardMaterial color={colors.text} opacity={0.26} transparent />
      </mesh>
    </group>
  );
}

function SensorSwath({ color }: { color: string }) {
  return (
    <group>
      {SENSOR_LINES.map((line) => (
        <BiologyLine
          color={color}
          key={line.id}
          lineWidth={1}
          points={line.points}
        />
      ))}
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
