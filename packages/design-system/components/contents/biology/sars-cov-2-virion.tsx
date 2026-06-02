"use client";

import { useGLTF } from "@react-three/drei";
import { SARS_COV_2_VIRION_ASSET } from "@repo/design-system/components/contents/biology/assets";
import type {
  BiologyLabProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import { useMemo } from "react";
import { Box3, type Group, Mesh, MeshStandardMaterial, Vector3 } from "three";

const SARS_COV_2_VIEW = {
  cameraPosition: [2.06, 1.22, 2.56],
  cameraTarget: [0, 0.04, 0],
  narrowCameraPosition: [2.38, 1.48, 3.02],
} satisfies BiologySceneView;

/**
 * Shows a SARS-CoV-2 surface model for real virion inspection.
 */
export function SarsCov2VirionLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={SarsCov2VirionScene}
      view={SARS_COV_2_VIEW}
      {...props}
    />
  );
}

function SarsCov2VirionScene() {
  return (
    <group position={[0, 0.2, 0]} rotation={[-0.08, -0.22, 0.02]}>
      <SarsCov2VirionModel />
    </group>
  );
}

function SarsCov2VirionModel() {
  const { scene } = useGLTF(SARS_COV_2_VIRION_ASSET.path);
  const virion = useMemo(() => prepareVirionScene(scene), [scene]);

  return <primitive object={virion} />;
}

function prepareVirionScene(source: Group) {
  const virion = source.clone(true);
  const bounds = new Box3().setFromObject(virion);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = 1.72 / Math.max(size.x, size.y, size.z);

  virion.scale.setScalar(scale);
  virion.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  virion.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.geometry.computeVertexNormals();
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
    });
  });

  return virion;
}

useGLTF.preload(SARS_COV_2_VIRION_ASSET.path);
