"use client";

import { useGLTF } from "@react-three/drei";
import { SARS_COV_2_VIRION_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
import type {
  BiologyLabProps,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import { useMemo } from "react";
import { Box3, type Group, Mesh, MeshStandardMaterial, Vector3 } from "three";

const SARS_COV_2_VIEW = {
  cameraPosition: [2.2, 1.34, 2.72],
  cameraTarget: [0, 0.04, 0],
  maxAzimuthAngle: Math.PI / 16,
  maxPolarAngle: Math.PI / 2.42,
  minAzimuthAngle: -Math.PI / 16,
  minPolarAngle: Math.PI / 3.15,
  narrowCameraPosition: [2.52, 1.66, 3.18],
} satisfies BiologySceneView;

const SARS_COV_2_CALLOUTS = [
  {
    id: "surface-protein",
    labelPosition: [1.02, 1.02, 0.72],
    target: [0.44, 0.74, 0.48],
  },
  {
    id: "envelope",
    labelPosition: [-1.08, -0.82, 0.62],
    target: [-0.02, -0.2, 0.82],
  },
] as const;

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

function SarsCov2VirionScene({ colors, item }: BiologySceneProps) {
  return (
    <group rotation={[-0.08, -0.22, 0.02]}>
      <SarsCov2VirionModel />

      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={SARS_COV_2_CALLOUTS}
      />
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
  const scale = 1.92 / Math.max(size.x, size.y, size.z);

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
