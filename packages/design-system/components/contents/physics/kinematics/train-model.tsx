"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Color, type Material, Mesh, Vector3 } from "three";

const COLORABLE_TRAIN_PART_NAMES = new Set(["train-electric-bullet-a"]);

interface PhysicsTrainModelProps {
  bodyColor?: string;
  modelPath: string;
}

export function PhysicsTrainModel({
  bodyColor,
  modelPath,
}: PhysicsTrainModelProps) {
  const { scene } = useGLTF(modelPath);
  const train = useMemo(() => {
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);

    clone.position.copy(new Vector3(0, -box.min.y, 0));
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (bodyColor && COLORABLE_TRAIN_PART_NAMES.has(child.name)) {
        child.material = tintMaterial(child.material, bodyColor);
      }
    });

    return clone;
  }, [bodyColor, scene]);

  return <primitive object={train} />;
}

function tintMaterial(material: Mesh["material"], color: string) {
  if (Array.isArray(material)) {
    return material.map((item) => tintSingleMaterial(item, color));
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
