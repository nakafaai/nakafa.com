import { useGLTF } from "@react-three/drei";
import { SARS_COV_2_VIRION_ASSET } from "@repo/design-system/components/contents/biology/assets";
import {
  BiologyLabFrame,
  type BiologyLabProps,
} from "@repo/design-system/components/contents/biology/lab";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { VIRION_COLORS } from "@repo/design-system/lib/material/virion";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import {
  Box3,
  Color,
  Float32BufferAttribute,
  type Group,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

const SARS_COV_2_VIEW = {
  cameraPosition: [2.06, 1.22, 2.56],
  cameraTarget: [0, 0.04, 0],
  narrowCameraPosition: [2.38, 1.48, 3.02],
} satisfies NarrowCameraPose;

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

/**
 * The NIAID model marks its parts with flat false colours: cyan for the lipid
 * envelope, pale pink for the spikes, and orange for the membrane and
 * envelope proteins between them. Each vertex is weighed between the three
 * and repainted in the natural tones the other virus labs use.
 */
function natural(red: number, green: number, blue: number) {
  const envelope = Math.min(1, Math.max(0, (blue - red) * 2.5));
  const protein =
    Math.min(1, Math.max(0, (red - green - 0.3) * 3)) * (1 - envelope);
  const spike = 1 - envelope - protein;
  const tones = [
    [new Color(VIRION_COLORS.viralEnvelope), envelope],
    [new Color(VIRION_COLORS.membraneDimer), protein],
    [new Color(CELL_COLORS.spike), spike],
  ] as const;
  return Arr.reduce(tones, new Color(0, 0, 0), (sum, [tone, weight]) =>
    sum.add(tone.clone().multiplyScalar(weight))
  );
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

    const geometry = child.geometry.clone();
    const marks = geometry.getAttribute("color");
    const colors = Arr.flatMap(Arr.range(0, marks.count - 1), (index) =>
      natural(marks.getX(index), marks.getY(index), marks.getZ(index)).toArray()
    );
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    child.geometry = geometry;
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = new MeshPhysicalMaterial({
      clearcoat: 0.35,
      clearcoatRoughness: 0.45,
      metalness: 0,
      roughness: 0.55,
      vertexColors: true,
    });
  });

  return virion;
}

useGLTF.preload(SARS_COV_2_VIRION_ASSET.path);
