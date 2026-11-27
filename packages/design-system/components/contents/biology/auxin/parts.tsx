import { Turn } from "@repo/design-system/components/three/form/part";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";

const SHADE_PROFILE = [
  [0.032, -0.04],
  [0.052, 0.02],
  [0.125, 0.14],
  [0.14, 0.165],
  [0.132, 0.168],
  [0.046, 0.022],
] as const;

const BASE_PROFILE = [
  [0, 0],
  [0.15, 0],
  [0.155, 0.025],
  [0.115, 0.045],
  [0.042, 0.068],
  [0.022, 0.085],
] as const;

/** Brass directional laboratory lamp casting a warm volumetric phototropism beam onto the lit flank. */
export function DirectionalBrassLamp({
  position = [0.95, 0, 0],
}: {
  readonly position?: readonly [number, number, number];
}) {
  const gooseneck = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.08, 0),
        new Vector3(0.06, 0.48, 0),
        new Vector3(0.02, 0.96, 0),
        new Vector3(-0.14, 1.12, 0),
      ]),
    []
  );

  return (
    <group position={position}>
      {/* Turned weighted brass base */}
      <mesh castShadow receiveShadow>
        <Turn profile={BASE_PROFILE} />
        <MetalMaterial color={BOTANY_COLORS.brassGold} roughness={0.34} />
      </mesh>
      {/* Articulated brass gooseneck stem */}
      <mesh castShadow>
        <tubeGeometry args={[gooseneck, 28, 0.018, 12, false]} />
        <MetalMaterial color={BOTANY_COLORS.brassDark} roughness={0.36} />
      </mesh>
      {/* Lamp head aimed toward the coleoptile lit side */}
      <group position={[-0.17, 1.09, 0]} rotation={[0, 0, 1.98]}>
        <mesh castShadow>
          <Turn profile={SHADE_PROFILE} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={BOTANY_COLORS.brassGold}
            metalness={0.85}
            roughness={0.28}
            side={DoubleSide}
          />
        </mesh>
        {/* Glowing incandescent tungsten bulb */}
        <mesh position={[0, 0.075, 0]}>
          <sphereGeometry args={[0.044, 20, 16]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.lampFilament}
            emissive={BOTANY_COLORS.lampFilament}
            emissiveIntensity={2.2}
            roughness={0.15}
          />
        </mesh>
        {/* Soft volumetric light cone */}
        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[0.34, 0.11, 0.88, 28, 1, true]} />
          <meshBasicMaterial
            color={BOTANY_COLORS.lampBeam}
            depthWrite={false}
            opacity={0.12}
            side={DoubleSide}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Curved fibrous grass coleoptile with an axial front cutaway exposing
 * elongated parenchyma cells on the shaded left side vs compact cells on the lit right side.
 */
export function ColeoptileCutaway({ bendRad }: { readonly bendRad: number }) {
  const { litCells, shadedCells, sheathCurve, tipPoint } = useMemo(() => {
    const pts = Arr.makeBy(10, (idx) => {
      const t = idx / 9;
      const theta = bendRad * t * t;
      const x = Math.sin(theta) * 0.52 * t;
      const y = 0.32 + t * 0.92 * Math.cos(theta * 0.55);
      return new Vector3(x, y, 0);
    });
    const curve = new CatmullRomCurve3(pts);

    // Shaded (outer left) cells elongate progressively with auxin level
    const shadedCount = Math.max(4, Math.round(7 - (bendRad / 0.92) * 2.5));
    const shaded = Arr.makeBy(shadedCount, (i) => {
      const t = (i + 0.5) / shadedCount;
      const p = curve.getPoint(0.08 + t * 0.82);
      const tang = curve.getTangent(0.08 + t * 0.82);
      const normal = new Vector3(-tang.y, tang.x, 0).normalize();
      const angle = Math.atan2(tang.y, tang.x) - Math.PI / 2;
      const h = (0.72 / shadedCount) * 0.86;
      return {
        angle,
        h,
        id: `sh-${i}`,
        pos: p.clone().addScaledVector(normal, 0.044),
      };
    });

    // Lit (inner right) cells remain short and compact
    const litCount = 9;
    const lit = Arr.makeBy(litCount, (i) => {
      const t = (i + 0.5) / litCount;
      const p = curve.getPoint(0.08 + t * 0.82);
      const tang = curve.getTangent(0.08 + t * 0.82);
      const normal = new Vector3(tang.y, -tang.x, 0).normalize();
      const angle = Math.atan2(tang.y, tang.x) - Math.PI / 2;
      const h = (0.68 / litCount) * 0.84;
      return {
        angle,
        h,
        id: `lt-${i}`,
        pos: p.clone().addScaledVector(normal, 0.044),
      };
    });

    return {
      litCells: lit,
      shadedCells: shaded,
      sheathCurve: curve,
      tipPoint: curve.getPoint(1),
    };
  }, [bendRad]);

  return (
    <group>
      {/* Back fibrous coleoptile sheath */}
      <mesh castShadow position={[0, 0, -0.025]} receiveShadow>
        <tubeGeometry args={[sheathCurve, 32, 0.115, 18, false]} />
        <meshPhysicalMaterial
          clearcoat={0.22}
          color={BOTANY_COLORS.healthyLeafDeep}
          roughness={0.54}
        />
      </mesh>
      {/* Basal coleoptile collar emerging from peat soil */}
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.125, 0.145, 0.1, 24]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.epidermisTan}
          roughness={0.72}
        />
      </mesh>
      {/* Elongated turgid parenchyma cells on shaded (auxin-rich) left flank */}
      {Arr.map(shadedCells, (cell) => (
        <mesh
          castShadow
          key={cell.id}
          position={[cell.pos.x, cell.pos.y, 0.072]}
          rotation={[0, 0, cell.angle]}
        >
          <capsuleGeometry
            args={[0.032, Math.max(0.02, cell.h - 0.04), 8, 12]}
          />
          <meshPhysicalMaterial
            clearcoat={0.35}
            color={BOTANY_COLORS.healthyLeaf}
            roughness={0.38}
          />
        </mesh>
      ))}
      {/* Compact parenchyma cells on lit right flank */}
      {Arr.map(litCells, (cell) => (
        <mesh
          castShadow
          key={cell.id}
          position={[cell.pos.x, cell.pos.y, 0.072]}
          rotation={[0, 0, cell.angle]}
        >
          <capsuleGeometry
            args={[0.028, Math.max(0.015, cell.h - 0.036), 8, 12]}
          />
          <meshPhysicalMaterial
            clearcoat={0.25}
            color={BOTANY_COLORS.mgInterveinal}
            roughness={0.46}
          />
        </mesh>
      ))}
      {/* Translucent amber auxin-infused agar block seated off-centre on the cut apex */}
      <mesh
        castShadow
        position={[
          tipPoint.x - Math.cos(bendRad) * 0.055,
          tipPoint.y + 0.055,
          0.01,
        ]}
        rotation={[0, 0, -bendRad]}
      >
        <boxGeometry args={[0.16, 0.11, 0.15]} />
        <meshPhysicalMaterial
          clearcoat={0.9}
          clearcoatRoughness={0.12}
          color={BOTANY_COLORS.agarAmber}
          ior={1.38}
          opacity={0.82}
          roughness={0.15}
          transparent
        />
      </mesh>
    </group>
  );
}
