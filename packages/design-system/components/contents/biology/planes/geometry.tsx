import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  PlaneGeometry,
  Quaternion,
  Shape,
  Vector3,
} from "three";

const UP = new Vector3(0, 1, 0);

/** Builds ridged translucent dicot epidermis + sculpted parenchyma pith + collateral vascular bundle shapes. */
export function useDicotStemGeometries() {
  const assets = useMemo(() => {
    // Sculpted fluted epidermis cylinder with subtle botanical ridges and a natural node swell.
    const epidermis = new CylinderGeometry(0.32, 0.34, 1.18, 48, 28, true);
    const epiPos = epidermis.getAttribute("position");
    const epiColors = new Float32Array(epiPos.count * 3);
    const epiDark = new Color(BIOLOGY_COLORS.stemEpidermis);
    const epiLight = new Color(BIOLOGY_COLORS.stemCortex);
    const tmp = new Color();

    for (let i = 0; i < epiPos.count; i += 1) {
      const x = epiPos.getX(i);
      const y = epiPos.getY(i);
      const z = epiPos.getZ(i);
      const theta = Math.atan2(z, x);
      const ridge = 1 + 0.028 * Math.sin(theta * 20);
      const nodeSwell = 1 + 0.045 * Math.exp(-(((y - 0.12) / 0.11) ** 2));
      const grain = (valueNoise(theta * 3, y * 6, 17) - 0.5) * 0.012;
      const scale = ridge * nodeSwell + grain;
      epiPos.setXYZ(i, x * scale, y, z * scale);

      const shade = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(theta * 20));
      tmp.copy(epiDark).lerp(epiLight, shade * 0.45);
      epiColors[i * 3] = tmp.r;
      epiColors[i * 3 + 1] = tmp.g;
      epiColors[i * 3 + 2] = tmp.b;
    }
    epidermis.setAttribute("color", new BufferAttribute(epiColors, 3));
    epidermis.computeVertexNormals();

    // Sculpted top/bottom botanical tissue cap ring (cortex + pith cross-section visibility).
    const cortexRing = new CylinderGeometry(0.3, 0.31, 1.14, 42, 1, false);

    // Fibrous sclerenchyma cap (crescent cross-section extruded along stem height).
    const capShape = new Shape();
    capShape.absarc(0, 0, 0.04, -Math.PI * 0.42, Math.PI * 0.42, false);
    capShape.absarc(-0.015, 0, 0.032, Math.PI * 0.38, -Math.PI * 0.38, true);
    capShape.closePath();
    const sclerenchymaCap = new ExtrudeGeometry(capShape, {
      bevelEnabled: false,
      depth: 1.17,
      steps: 1,
    });
    sclerenchymaCap.rotateX(-Math.PI / 2);
    sclerenchymaCap.translate(0, -0.585, 0);

    // Spongy parenchymal pith core with subtle cellular surface relief.
    const pith = new CylinderGeometry(0.135, 0.14, 1.17, 28, 14);
    const pithPos = pith.getAttribute("position");
    for (let i = 0; i < pithPos.count; i += 1) {
      const x = pithPos.getX(i);
      const y = pithPos.getY(i);
      const z = pithPos.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 0.01) {
        const bump = 1 + (valueNoise(x * 16, y * 10 + z * 16, 23) - 0.5) * 0.07;
        pithPos.setXYZ(i, x * bump, y, z * bump);
      }
    }
    pith.computeVertexNormals();

    // Thin vascular cambium cylinder connecting the ring of vascular bundles.
    const cambium = new CylinderGeometry(0.212, 0.212, 1.165, 42, 1, true);

    return { cambium, cortexRing, epidermis, pith, sclerenchymaCap };
  }, []);

  useEffect(
    () => () => {
      assets.epidermis.dispose();
      assets.cortexRing.dispose();
      assets.sclerenchymaCap.dispose();
      assets.pith.dispose();
      assets.cambium.dispose();
    },
    [assets]
  );

  return assets;
}

/** Crisp glass cutting plane + glowing outline frame for anatomical & botanical sections. */
export function FramedSectionPlane({
  color,
  position,
  rotation,
  size,
}: {
  readonly color: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly size: readonly [number, number];
}) {
  const { borderGeo, planeGeo } = useMemo(() => {
    const plane = new PlaneGeometry(size[0], size[1]);
    const border = new EdgesGeometry(plane);
    return { borderGeo: border, planeGeo: plane };
  }, [size[0], size[1]]);

  useEffect(
    () => () => {
      planeGeo.dispose();
      borderGeo.dispose();
    },
    [borderGeo, planeGeo]
  );

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={planeGeo}>
        <meshPhysicalMaterial
          clearcoat={0.9}
          clearcoatRoughness={0.12}
          color={color}
          depthWrite={false}
          opacity={0.24}
          roughness={0.14}
          side={2}
          transparent
        />
      </mesh>
      <lineSegments geometry={borderGeo}>
        <lineBasicMaterial color={color} />
      </lineSegments>
    </group>
  );
}

/** 3D double-ended directional axis indicator with tapered conical tips. */
export function AnatomicalDirectionAxis({
  end,
  endColor,
  start,
  startColor,
}: {
  readonly end: readonly [number, number, number];
  readonly endColor: string;
  readonly start: readonly [number, number, number];
  readonly startColor: string;
}) {
  const { length, midpoint, quaternion } = useMemo(() => {
    const s = new Vector3(start[0], start[1], start[2]);
    const e = new Vector3(end[0], end[1], end[2]);
    const dir = e.clone().sub(s);
    const len = Math.max(0.01, dir.length());
    const mid = s.clone().add(e).multiplyScalar(0.5);
    const quat = new Quaternion().setFromUnitVectors(UP, dir.normalize());
    return {
      length: len,
      midpoint: [mid.x, mid.y, mid.z] as const,
      quaternion: quat,
    };
  }, [end, start]);

  const shaftLength = Math.max(0.04, length - 0.12);
  const tipOffset = length / 2 - 0.045;

  return (
    <group position={midpoint} quaternion={quaternion}>
      <mesh castShadow>
        <cylinderGeometry args={[0.011, 0.011, shaftLength, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={startColor}
          metalness={0.15}
          roughness={0.32}
        />
      </mesh>
      <mesh castShadow position={[0, -tipOffset, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.032, 0.09, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={startColor}
          roughness={0.28}
        />
      </mesh>
      <mesh castShadow position={[0, tipOffset, 0]}>
        <coneGeometry args={[0.032, 0.09, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={endColor}
          roughness={0.28}
        />
      </mesh>
    </group>
  );
}

/** Medullary ray angular offsets interleaved between vascular bundles. */
export function buildMedullaryRayAngles(bundles: readonly number[]) {
  return Arr.map(bundles, (angle) => angle + Math.PI / bundles.length);
}
