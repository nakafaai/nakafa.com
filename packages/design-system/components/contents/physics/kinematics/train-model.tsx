"use client";

import { useGLTF } from "@react-three/drei";
import { tintMaterial } from "@repo/design-system/components/three/material";
import { HashSet } from "effect";
import { useMemo } from "react";
import { Box3, Mesh, Vector3 } from "three";

const COLORABLE_TRAIN_PART_NAMES = HashSet.make("train-electric-bullet-a");

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

      if (bodyColor && HashSet.has(COLORABLE_TRAIN_PART_NAMES, child.name)) {
        child.material = tintMaterial(child.material, bodyColor);
      }
    });

    return clone;
  }, [bodyColor, scene]);

  return <primitive object={train} />;
}
