"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Mesh, Vector3 } from "three";

interface PhysicsCarModelProps {
  modelPath: string;
}

export function PhysicsCarModel({ modelPath }: PhysicsCarModelProps) {
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
    });

    return clone;
  }, [scene]);

  return <primitive object={car} />;
}
