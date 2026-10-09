"use client";

import { useGLTF } from "@react-three/drei";
import { tintMaterial } from "@repo/design-system/components/three/material";
import { Array as Arr, HashSet } from "effect";
import { useMemo } from "react";
import { Box3, Mesh, Vector3 } from "three";

const COLORABLE_CAR_PART_NAMES = HashSet.make("body", "kart-oobi", "spoiler");
const COLORABLE_CAR_MATERIAL_NAMES = HashSet.make("Body", "Red_Chasis");

interface PhysicsCarModelProps {
  bodyColor?: string;
  modelPath: string;
}

export function PhysicsCarModel({
  bodyColor,
  modelPath,
}: PhysicsCarModelProps) {
  const { scene } = useGLTF(modelPath);
  const car = useMemo(() => {
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);
    clone.position.copy(new Vector3(0, -box.min.y, 0));

    clone.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (bodyColor && shouldTintCarPart(child)) {
        child.material = tintMaterial(child.material, bodyColor);
      }
    });

    return clone;
  }, [bodyColor, scene]);

  return <primitive object={car} />;
}

function shouldTintCarPart(mesh: Mesh) {
  if (HashSet.has(COLORABLE_CAR_PART_NAMES, mesh.name)) {
    return true;
  }

  const materials = Arr.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  return Arr.some(materials, (material) =>
    HashSet.has(COLORABLE_CAR_MATERIAL_NAMES, material.name)
  );
}
