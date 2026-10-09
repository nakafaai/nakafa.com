"use client";

import { useGLTF } from "@react-three/drei";
import { Array as Arr, HashSet } from "effect";
import { useMemo } from "react";
import { Box3, Color, type Material, Mesh, Vector3 } from "three";

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

function tintMaterial(material: Mesh["material"], color: string) {
  if (Arr.isArray(material)) {
    return Arr.map(material, (item) => tintSingleMaterial(item, color));
  }

  return tintSingleMaterial(material, color);
}

function tintSingleMaterial(material: Material, color: string) {
  const nextMaterial = material.clone();

  if (hasMaterialColor(nextMaterial)) {
    nextMaterial.color.set(color);
  }

  return nextMaterial;
}

function hasMaterialColor(
  material: Material
): material is Material & { color: Color } {
  return "color" in material && material.color instanceof Color;
}
