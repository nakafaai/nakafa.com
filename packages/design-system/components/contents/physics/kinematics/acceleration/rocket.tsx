"use client";

import { useGLTF } from "@react-three/drei";
import { ACCELERATION_ROCKET_MODEL_PATH } from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import {
  AnimatedExhaust,
  type RocketExhaust,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/exhaust";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { useMemo } from "react";
import { Box3, type Group, Mesh, MeshStandardMaterial, Vector3 } from "three";

const SPACE_COLORS = {
  rocketAccent: getColor("ORANGE", 500),
  rocketBody: getColor("ZINC", 100),
  rocketDark: getColor("SLATE", 600),
  rocketEngine: getColor("STONE", 600),
  rocketFairing: getColor("ZINC", 100),
  rocketWing: getColor("SLATE", 300),
};
const ROCKET_MODEL_ROTATION_Y = Math.PI / 2;
const ROCKET_NOZZLE_MESH_NAME = "nozzle_cap";
type VectorTuple = [number, number, number];
interface RocketAsset {
  exhaust: RocketExhaust;
  rocket: Group;
}

export function RocketShip({ flameDirection }: { flameDirection?: -1 | 1 }) {
  const { scene } = useGLTF(ACCELERATION_ROCKET_MODEL_PATH);
  const asset = useMemo(() => createRocketAsset(scene), [scene]);

  return (
    <group>
      <PegasusRocketModel rocket={asset.rocket} />
      {flameDirection ? (
        <CameraBounds exclude>
          <AnimatedExhaust direction={flameDirection} exhaust={asset.exhaust} />
        </CameraBounds>
      ) : null}
    </group>
  );
}

function PegasusRocketModel({ rocket }: { rocket: Group }) {
  return (
    <group rotation={[0, ROCKET_MODEL_ROTATION_Y, 0]}>
      <primitive object={rocket} />
    </group>
  );
}

function createRocketAsset(scene: Group): RocketAsset {
  const rocketMaterials = createRocketMaterials();
  const sceneBox = new Box3().setFromObject(scene);
  const center = sceneBox.getCenter(new Vector3());
  const clone = scene.clone(true);

  clone.position.sub(center);
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.material = getRocketMaterial(child.name, rocketMaterials);
  });

  return {
    exhaust: getRocketExhaust(scene, sceneBox, center),
    rocket: clone,
  };
}

function createRocketMaterials() {
  return {
    accent: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketAccent,
      metalness: 0.18,
      roughness: 0.42,
    }),
    body: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketBody,
      metalness: 0.12,
      roughness: 0.36,
    }),
    dark: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketDark,
      metalness: 0.2,
      roughness: 0.52,
    }),
    engine: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketEngine,
      metalness: 0.44,
      roughness: 0.34,
    }),
    fairing: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketFairing,
      metalness: 0.1,
      roughness: 0.28,
    }),
    wing: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketWing,
      metalness: 0.18,
      roughness: 0.42,
    }),
  } as const;
}

function getRocketMaterial(
  meshName: string,
  materials: ReturnType<typeof createRocketMaterials>
) {
  if (meshName.includes("fairing")) {
    return materials.fairing;
  }

  if (meshName.includes("nozzle")) {
    return materials.engine;
  }

  if (meshName === "_root") {
    return materials.body;
  }

  if (meshName.includes("stage_01")) {
    return materials.body;
  }

  if (meshName.includes("stage_03")) {
    return materials.dark;
  }

  if (meshName.includes("stage_02")) {
    return materials.accent;
  }

  return materials.accent;
}

function getRocketExhaust(
  scene: Group,
  sceneBox: Box3,
  center: Vector3
): RocketExhaust {
  const nozzle = scene.getObjectByName(ROCKET_NOZZLE_MESH_NAME);

  if (!nozzle) {
    const fallbackPoint = new Vector3(center.x, center.y, sceneBox.min.z);
    const fallbackSize = sceneBox.getSize(new Vector3());

    return {
      anchor: rotateCenteredRocketPoint(fallbackPoint, center),
      radius: Math.min(fallbackSize.x, fallbackSize.y) / 2,
    };
  }

  const nozzleBox = new Box3().setFromObject(nozzle);
  const nozzleCenter = nozzleBox.getCenter(new Vector3());
  const nozzleSize = nozzleBox.getSize(new Vector3());

  return {
    anchor: rotateCenteredRocketPoint(nozzleCenter, center),
    radius: Math.max(nozzleSize.x, nozzleSize.y) / 2,
  };
}

function rotateCenteredRocketPoint(
  point: Vector3,
  center: Vector3
): VectorTuple {
  const localPoint = point.clone().sub(center);
  const rotationCos = Math.cos(ROCKET_MODEL_ROTATION_Y);
  const rotationSin = Math.sin(ROCKET_MODEL_ROTATION_Y);

  return [
    localPoint.x * rotationCos + localPoint.z * rotationSin,
    localPoint.y,
    -localPoint.x * rotationSin + localPoint.z * rotationCos,
  ];
}

useGLTF.preload(ACCELERATION_ROCKET_MODEL_PATH);
