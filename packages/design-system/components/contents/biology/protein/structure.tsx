import type {
  Condition,
  Level,
  polypeptideBeads,
} from "@repo/design-system/components/contents/biology/protein/folding";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

export const SUBUNIT_COLORS = [
  PLOT_COLORS.teal,
  PLOT_COLORS.violet,
  PLOT_COLORS.amber,
  PLOT_COLORS.pink,
] as const;

export const QUATERNARY_HAEMS: readonly (readonly [number, number, number])[] =
  [
    [-0.32, 0.78, 0.12],
    [0.32, 0.78, -0.12],
    [-0.32, 0.38, -0.12],
    [0.32, 0.38, 0.12],
  ];

const ACID_PROTONS: readonly (readonly [number, number, number])[] = [
  [-0.64, 0.92, 0.16],
  [-0.22, 0.88, -0.14],
  [0.24, 0.94, 0.18],
  [0.62, 0.86, -0.12],
  [-0.4, 0.28, 0.22],
  [0.42, 0.3, 0.2],
];

export function buildSubunitChains(
  beads: ReturnType<typeof polypeptideBeads>,
  level: Level,
  condition: Condition
) {
  if (condition === "normal" && level === "quaternary") {
    return Arr.map(QUATERNARY_HAEMS, ([cx, cy, cz], subunit) => ({
      color:
        SUBUNIT_COLORS[subunit % SUBUNIT_COLORS.length] ?? PLOT_COLORS.teal,
      points: Arr.makeBy(28, (step) => {
        const t = step / 27;
        const a = t * Math.PI * 5.2 + subunit * 1.1;
        const r = 0.145 + Math.sin(t * Math.PI * 3) * 0.045;
        return [
          cx + Math.cos(a) * r,
          cy + (t - 0.5) * 0.24 + Math.sin(a * 0.5) * 0.05,
          cz + Math.sin(a) * r,
        ] as const;
      }),
      subunit,
    }));
  }
  const ids = Arr.dedupe(Arr.map(beads, (b) => b.subunit));
  return Arr.map(ids, (subunit) => ({
    color: SUBUNIT_COLORS[subunit % SUBUNIT_COLORS.length] ?? PLOT_COLORS.teal,
    points: Arr.map(
      Arr.filter(beads, (b) => b.subunit === subunit),
      (b) => b.position
    ),
    subunit,
  }));
}

export function buildStabilisingBonds(
  beads: ReturnType<typeof polypeptideBeads>,
  level: Level,
  condition: Condition
) {
  if (condition !== "normal") {
    return [];
  }
  if (level === "secondary") {
    const helix = Arr.filter(beads, (b) => b.subunit === 0);
    const sheet = Arr.filter(beads, (b) => b.subunit === 1);
    const helixBonds = Arr.map(
      Arr.filter(helix, (_, i) => i + 3 < helix.length),
      (b, i) => ({
        end: helix[i + 3]?.position ?? b.position,
        id: `hb-h-${b.id}`,
        start: b.position,
      })
    );
    const sheetBonds = Arr.map(
      Arr.filter(sheet, (_, i) => i % 2 === 0 && i + 2 < sheet.length),
      (b, i) => ({
        end: sheet[i * 2 + 2]?.position ?? b.position,
        id: `hb-s-${b.id}`,
        start: b.position,
      })
    );
    return Arr.appendAll(helixBonds, sheetBonds);
  }
  if (level === "tertiary") {
    return [
      {
        end: beads[14]?.position ?? [0.1, 0.5, 0],
        id: "ss-0",
        start: beads[4]?.position ?? [-0.1, 0.5, 0],
      },
      {
        end: beads[17]?.position ?? [0.1, 0.6, 0],
        id: "ss-1",
        start: beads[9]?.position ?? [-0.1, 0.6, 0],
      },
    ];
  }
  return [];
}

/** Detailed porphyrin haem prosthetic group: 4 pyrrole rings around a glowing central Fe2+ ion. */
export function HaemProstheticGroup({
  position,
  scale = 1,
}: {
  readonly position: readonly [number, number, number];
  readonly scale?: number;
}) {
  const pyrroles = [
    [0.058, 0, 0],
    [-0.058, 0, 0],
    [0, 0.058, 0],
    [0, -0.058, 0],
  ] as const;

  return (
    <group position={position} rotation={[0.35, 0.2, 0]} scale={scale}>
      <mesh castShadow>
        <torusGeometry args={[0.072, 0.015, 12, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={GENETICS_COLORS.porphyrinRing}
          roughness={0.28}
        />
      </mesh>
      {Arr.map(pyrroles, (pos, idx) => (
        <mesh
          castShadow
          key={`py-${pos[0]}-${pos[1]}`}
          position={pos}
          rotation={[Math.PI / 2, 0, idx * (Math.PI / 2)]}
        >
          <cylinderGeometry args={[0.024, 0.024, 0.014, 5]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={GENETICS_COLORS.porphyrinRing}
            roughness={0.32}
          />
        </mesh>
      ))}
      <mesh castShadow>
        <sphereGeometry args={[0.032, 18, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.9}
          color={GENETICS_COLORS.hemeIron}
          emissive={GENETICS_COLORS.hemeIron}
          emissiveIntensity={0.38}
          metalness={0.65}
          roughness={0.18}
        />
      </mesh>
    </group>
  );
}

/** Sculpted smooth polypeptide ribbon tube for one contiguous subunit chain. */
export function SubunitRibbon({
  color,
  points,
  radius,
}: {
  readonly color: string;
  readonly points: readonly (readonly [number, number, number])[];
  readonly radius: number;
}) {
  const geo = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const curve = new CatmullRomCurve3(
      Arr.map(points, ([x, y, z]) => new Vector3(x, y, z))
    );
    return new TubeGeometry(curve, points.length * 10, radius, 14, false);
  }, [points, radius]);

  useEffect(() => () => geo?.dispose(), [geo]);

  if (geo === null) {
    return null;
  }

  return (
    <mesh castShadow geometry={geo} receiveShadow>
      <meshPhysicalMaterial
        clearcoat={0.62}
        clearcoatRoughness={0.24}
        color={color}
        roughness={0.32}
      />
    </mesh>
  );
}

/** Denaturing environment props: floating H+ protons for acid or glowing brass burner coil for heat. */
export function DenaturationEnvironment({
  condition,
}: {
  readonly condition: Condition;
}) {
  if (condition === "acid") {
    return (
      <group>
        {Arr.map(ACID_PROTONS, (pos) => (
          <group key={`h-${pos[0]}-${pos[1]}-${pos[2]}`} position={pos}>
            <mesh castShadow>
              <sphereGeometry args={[0.032, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.85}
                color={ATOM_COLORS.cpkHydrogen}
                emissive={GENETICS_COLORS.brokenHighlight}
                emissiveIntensity={0.35}
                roughness={0.18}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.052, 12, 10]} />
              <meshPhysicalMaterial
                color={GENETICS_COLORS.brokenHighlight}
                opacity={0.2}
                roughness={0.2}
                transparent
              />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (condition === "heated") {
    return (
      <group position={[0, 0.08, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.64, 0.7, 0.036, 36]} />
          <MetalMaterial color={GENETICS_COLORS.brassDark} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.024, 14, 48]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.flame}
            emissive={LABORATORY_COLORS.flame}
            emissiveIntensity={1.15}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.02, 12, 36]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.flame}
            emissive={LABORATORY_COLORS.flame}
            emissiveIntensity={0.95}
            roughness={0.22}
          />
        </mesh>
      </group>
    );
  }
  return null;
}
