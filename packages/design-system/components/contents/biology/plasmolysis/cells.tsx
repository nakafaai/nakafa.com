import { LabeledVessel } from "@repo/design-system/components/contents/biology/fixtures";
import type {
  CellOutcome,
  Tonicity,
} from "@repo/design-system/components/contents/biology/plasmolysis/model";
import { Turn } from "@repo/design-system/components/three/form/part";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";

const CHLOROPLAST_SLOTS = [
  { id: "cp1", pos: [-0.28, 0.2, 0.1] as const, rot: [0.2, 0.4, 0.3] as const },
  {
    id: "cp2",
    pos: [0.3, 0.16, 0.06] as const,
    rot: [-0.2, -0.3, 0.5] as const,
  },
  {
    id: "cp3",
    pos: [-0.24, -0.2, 0.12] as const,
    rot: [0.3, 0.2, -0.4] as const,
  },
  {
    id: "cp4",
    pos: [0.26, -0.22, 0.08] as const,
    rot: [-0.15, 0.5, -0.3] as const,
  },
  {
    id: "cp5",
    pos: [0.02, 0.28, -0.14] as const,
    rot: [0.4, 0.1, 0.2] as const,
  },
] as const;

const PLASMODESMATA = [
  [-0.56, 0.18, 0],
  [-0.56, -0.18, 0],
  [0.56, 0.18, 0],
  [0.56, -0.18, 0],
] as const;

const RBC_BICONCAVE_PROFILE = [
  [0, -0.055],
  [0.14, -0.068],
  [0.28, -0.145],
  [0.42, -0.155],
  [0.5, -0.085],
  [0.52, 0],
  [0.5, 0.085],
  [0.42, 0.155],
  [0.28, 0.145],
  [0.14, 0.068],
  [0, 0.055],
] as const;

/** Rigid polygonal cellulose cell wall housing (open at front) with plasmodesmata channels. */
export function PlantCellWallCutaway() {
  return (
    <group>
      {/* Back wall */}
      <mesh castShadow position={[0, 0, -0.44]} receiveShadow>
        <boxGeometry args={[1.18, 0.96, 0.085]} />
        <meshPhysicalMaterial
          clearcoat={0.28}
          color={HOMEOSTASIS_COLORS.cellWall}
          roughness={0.56}
        />
      </mesh>
      {/* Left & right thick cellulose walls */}
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={`wall-${side}`}
          position={[side * 0.55, 0, -0.04]}
          receiveShadow
        >
          <boxGeometry args={[0.085, 0.96, 0.88]} />
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={HOMEOSTASIS_COLORS.cellWall}
            roughness={0.56}
          />
        </mesh>
      ))}
      {/* Top & bottom cellulose walls */}
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={`cap-${side}`}
          position={[0, side * 0.44, -0.04]}
          receiveShadow
        >
          <boxGeometry args={[1.18, 0.085, 0.88]} />
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={HOMEOSTASIS_COLORS.cellWall}
            roughness={0.56}
          />
        </mesh>
      ))}
      {/* Plasmodesmata pores traversing lateral cell walls */}
      {Arr.map(PLASMODESMATA, ([px, py, pz]) => (
        <mesh
          key={`pm-${px}-${py}-${pz}`}
          position={[px, py, pz]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.12, 12]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.membrane}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Flexible plasma membrane, cytoplasmic chloroplasts, nucleus, and central vacuole inside the plant cell. */
export function PlantProtoplast({
  outcome,
}: {
  readonly outcome: CellOutcome;
}) {
  const isPlasmolysed = outcome === "plasmolysed";
  const hechtianStrands = useMemo(() => {
    if (!isPlasmolysed) {
      return [];
    }
    return Arr.map(PLASMODESMATA, ([px, py, pz]) => {
      const curve = new CatmullRomCurve3([
        new Vector3(px * 0.9, py, pz),
        new Vector3(px * 0.65, py * 0.8, pz + 0.04),
        new Vector3(px * 0.48, py * 0.65, pz),
      ]);
      return {
        geo: new TubeGeometry(curve, 12, 0.009, 6, false),
        id: `hs-${px}-${py}-${pz}`,
      };
    });
  }, [isPlasmolysed]);
  useEffect(
    () => () => {
      Arr.forEach(hechtianStrands, ({ geo }) => geo.dispose());
    },
    [hechtianStrands]
  );

  return (
    <group>
      {/* Translucent flexible plasma membrane cutaway */}
      <mesh>
        <sphereGeometry args={[0.48, 36, 26, Math.PI * 0.72, Math.PI * 1.56]} />
        <meshPhysicalMaterial
          clearcoat={0.75}
          clearcoatRoughness={0.2}
          color={HOMEOSTASIS_COLORS.membrane}
          opacity={0.46}
          roughness={0.28}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {/* Large glossy tinted central vacuole */}
      <mesh
        position={[0.02, -0.02, -0.02]}
        scale={isPlasmolysed ? [0.78, 0.68, 0.72] : [1.05, 0.86, 0.82]}
      >
        <sphereGeometry args={[0.31, 28, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.95}
          clearcoatRoughness={0.08}
          color={HOMEOSTASIS_COLORS.vacuole}
          ior={1.34}
          opacity={0.76}
          roughness={0.14}
          transparent
        />
      </mesh>
      {/* Peripheral lenticular chloroplasts */}
      {Arr.map(CHLOROPLAST_SLOTS, (cp) => (
        <mesh
          castShadow
          key={cp.id}
          position={cp.pos}
          rotation={cp.rot}
          scale={[1.4, 0.65, 0.85]}
        >
          <sphereGeometry args={[0.062, 16, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={FOLIAGE_COLORS.chloroplast}
            roughness={0.34}
          />
        </mesh>
      ))}
      {/* Sculpted nucleus with dark nucleolus */}
      <group position={[-0.22, 0.04, 0.22]}>
        <mesh castShadow>
          <sphereGeometry args={[0.082, 20, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={FOLIAGE_COLORS.nucleus}
            roughness={0.36}
          />
        </mesh>
        <mesh position={[0.02, 0.015, 0.05]}>
          <sphereGeometry args={[0.026, 12, 10]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.mitoticChromatin}
            roughness={0.42}
          />
        </mesh>
      </group>
      {/* Hechtian strands anchoring shrinking membrane to plasmodesmata during plasmolysis */}
      {Arr.map(hechtianStrands, ({ geo, id }) => (
        <mesh geometry={geo} key={id}>
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.membrane}
            roughness={0.38}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Realistic red blood cell morphing between biconcave disc (normal), spiked echinocyte (crenated), and swollen ghost cell (haemolysed). */
export function ErythrocyteSpecimen({
  outcome,
}: {
  readonly outcome: CellOutcome;
}) {
  const crenatedGeo = useMemo(() => {
    const geo = new SphereGeometry(0.46, 36, 26);
    const pos = geo.getAttribute("position");
    const v = new Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      const dir = v.clone().normalize();
      const spike =
        1 +
        0.16 *
          Math.max(
            0,
            Math.sin(dir.x * 16) * Math.sin(dir.y * 16) * Math.cos(dir.z * 16)
          );
      pos.setXYZ(i, v.x * spike, v.y * 0.54 * spike, v.z * spike);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  useEffect(() => () => crenatedGeo.dispose(), [crenatedGeo]);

  if (outcome === "crenated") {
    return (
      <mesh castShadow geometry={crenatedGeo}>
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={HOMEOSTASIS_COLORS.redBloodCell}
          roughness={0.38}
        />
      </mesh>
    );
  }

  if (outcome === "haemolysed") {
    return (
      <mesh castShadow>
        <sphereGeometry args={[0.48, 32, 24, 0, Math.PI * 1.75]} />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={HOMEOSTASIS_COLORS.redBloodCell}
          opacity={0.56}
          roughness={0.28}
          side={DoubleSide}
          transparent
        />
      </mesh>
    );
  }

  return (
    <mesh castShadow rotation={[0.45, 0, 0.15]}>
      <Turn profile={RBC_BICONCAVE_PROFILE} />
      <meshPhysicalMaterial
        clearcoat={0.62}
        clearcoatRoughness={0.22}
        color={HOMEOSTASIS_COLORS.redBloodCell}
        roughness={0.32}
      />
    </mesh>
  );
}

/** Flanking labeled borosilicate sucrose-solution beakers on the laboratory bench. */
export function SucroseBenchBeakers({
  solution,
}: {
  readonly solution: Tonicity;
}) {
  return (
    <group>
      <LabeledVessel
        accentColor={
          solution === "hypotonic"
            ? HOMEOSTASIS_COLORS.waterArrow
            : BOTANY_COLORS.labelBorder
        }
        badge="HYPOTONIC"
        fillFraction={0.78}
        height={0.36}
        liquidColor={BOTANY_COLORS.cohesionCyan}
        position={[-1.24, 0, -0.02]}
        radius={0.135}
        subtitle="0.0 M SUCROSE"
        title="H2O"
      />
      <LabeledVessel
        accentColor={
          solution === "hypertonic"
            ? HOMEOSTASIS_COLORS.arteriole
            : BOTANY_COLORS.labelBorder
        }
        badge="HYPERTONIC"
        fillFraction={0.72}
        height={0.36}
        liquidColor={BOTANY_COLORS.sucroseGold}
        position={[1.24, 0, -0.02]}
        radius={0.135}
        subtitle="0.5 M SUCROSE"
        title="SUCROSE"
      />
    </group>
  );
}
