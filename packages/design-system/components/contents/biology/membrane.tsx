import { MolecularStick } from "@repo/design-system/components/contents/biology/workbench";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/**
 * Multi-pass alpha-helical transmembrane protein channel composed of 6 tilted
 * coiled helical ribbon cylinders surrounding a central hydrophilic aqueous
 * pore, with extracellular and cytoplasmic vestibules.
 */
export function TransmembraneChannel({
  accentColor = HOMEOSTASIS_COLORS.helixBeta,
  color = HOMEOSTASIS_COLORS.helixAlpha,
  height = 0.62,
  opacity = 1,
  position = [0, 0.56, 0],
  radius = 0.155,
}: {
  readonly accentColor?: string;
  readonly color?: string;
  readonly height?: number;
  readonly opacity?: number;
  readonly position?: readonly [number, number, number];
  readonly radius?: number;
}) {
  const helices = useMemo(() => {
    const count = 6;
    return Arr.makeBy(count, (idx) => {
      const baseAngle = (idx / count) * Math.PI * 2;
      const pts = Arr.makeBy(22, (step) => {
        const t = step / 21;
        const y = (t - 0.5) * height;
        const twist = baseAngle + (t - 0.5) * 0.45;
        const coilAngle = t * Math.PI * 8;
        const r = radius + Math.cos(coilAngle) * 0.02;
        return new Vector3(
          Math.cos(twist) * r + Math.sin(coilAngle) * 0.012,
          y,
          Math.sin(twist) * r
        );
      });
      return {
        geo: new TubeGeometry(new CatmullRomCurve3(pts), 36, 0.036, 12, false),
        id: `hx-${idx}`,
        isAccent: idx % 2 === 1,
      };
    });
  }, [height, radius]);

  useEffect(
    () => () => {
      for (const h of helices) {
        h.geo.dispose();
      }
    },
    [helices]
  );

  const transparent = opacity < 0.99;

  return (
    <group position={position}>
      {Arr.map(helices, (helix) => (
        <mesh castShadow geometry={helix.geo} key={helix.id} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.62}
            clearcoatRoughness={0.24}
            color={helix.isAccent ? accentColor : color}
            opacity={opacity}
            roughness={0.34}
            transparent={transparent}
          />
        </mesh>
      ))}
      {Arr.map([-1, 1] as const, (end) => (
        <mesh
          castShadow
          key={end}
          position={[0, end * (height * 0.48), 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[radius * 0.95, 0.034, 14, 36]} />
          <meshPhysicalMaterial
            clearcoat={0.68}
            color={color}
            opacity={opacity}
            roughness={0.3}
            transparent={transparent}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Branched hexagonal oligosaccharide carbohydrate chain attached to a
 * glycoprotein or glycolipid on the extracellular face of the membrane.
 */
export function GlycanChain({
  branched = true,
  color = HOMEOSTASIS_COLORS.glycanHex,
  opacity = 1,
  position,
}: {
  readonly branched?: boolean;
  readonly color?: string;
  readonly opacity?: number;
  readonly position: readonly [number, number, number];
}) {
  const transparent = opacity < 0.99;
  const stem: readonly (readonly [number, number, number])[] = [
    [0, 0, 0],
    [0.04, 0.08, 0.015],
    [0.09, 0.16, -0.01],
    [0.14, 0.24, 0.02],
  ];
  const fork: readonly (readonly [number, number, number])[] = branched
    ? [
        [0.04, 0.08, 0.015],
        [-0.045, 0.16, 0.035],
        [-0.09, 0.23, 0.01],
      ]
    : [];

  return (
    <group position={position}>
      {Arr.map(stem, (pt, idx) => {
        const next = stem[idx + 1];
        return (
          <group key={`s-${pt[0]}-${pt[1]}`}>
            <mesh
              castShadow
              position={pt}
              rotation={[Math.PI / 2, idx * 0.4, 0.25]}
            >
              <cylinderGeometry args={[0.036, 0.036, 0.018, 6]} />
              <meshPhysicalMaterial
                clearcoat={0.62}
                color={color}
                opacity={opacity}
                roughness={0.3}
                transparent={transparent}
              />
            </mesh>
            {next === undefined ? null : (
              <MolecularStick
                color={color}
                end={next}
                opacity={opacity}
                radius={0.008}
                start={pt}
              />
            )}
          </group>
        );
      })}
      {Arr.map(fork, (pt, idx) => {
        const next = fork[idx + 1];
        return (
          <group key={`f-${pt[0]}-${pt[1]}`}>
            {idx > 0 ? (
              <mesh
                castShadow
                position={pt}
                rotation={[Math.PI / 2, -0.35, -0.3]}
              >
                <cylinderGeometry args={[0.033, 0.033, 0.018, 6]} />
                <meshPhysicalMaterial
                  clearcoat={0.62}
                  color={HOMEOSTASIS_COLORS.glycanBranch}
                  opacity={opacity}
                  roughness={0.3}
                  transparent={transparent}
                />
              </mesh>
            ) : null}
            {next === undefined ? null : (
              <MolecularStick
                color={HOMEOSTASIS_COLORS.glycanBranch}
                end={next}
                opacity={opacity}
                radius={0.008}
                start={pt}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Realistic molecular ATP / ADP + Pi nucleotide complex: purine adenine ring,
 * ribose pentose sugar, and high-energy glowing phosphate chain.
 */
export function NucleotideComplex({
  mode,
  opacity = 1,
  position,
}: {
  readonly mode: "atp" | "adp";
  readonly opacity?: number;
  readonly position: readonly [number, number, number];
}) {
  const transparent = opacity < 0.99;
  const phosphates =
    mode === "atp"
      ? [
          [0.09, 0, 0] as const,
          [0.165, 0.025, 0] as const,
          [0.24, -0.01, 0] as const,
        ]
      : [[0.09, 0, 0] as const, [0.165, 0.022, 0] as const];

  return (
    <group position={position}>
      <mesh
        castShadow
        position={[-0.08, 0.01, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.044, 0.044, 0.016, 6]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={HOMEOSTASIS_COLORS.adenosineRing}
          opacity={opacity}
          roughness={0.32}
          transparent={transparent}
        />
      </mesh>
      <mesh
        castShadow
        position={[0.005, -0.005, 0]}
        rotation={[Math.PI / 2, 0, 0.2]}
      >
        <cylinderGeometry args={[0.038, 0.038, 0.016, 5]} />
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={HOMEOSTASIS_COLORS.riboseSugar}
          opacity={opacity}
          roughness={0.36}
          transparent={transparent}
        />
      </mesh>
      <MolecularStick
        color={HOMEOSTASIS_COLORS.riboseSugar}
        end={[0.09, 0, 0]}
        opacity={opacity}
        radius={0.008}
        start={[0.025, -0.005, 0]}
      />
      {Arr.map(phosphates, (pos, idx) => {
        const next = phosphates[idx + 1];
        const isTerminal = idx === 2;
        let glowIntensity = 0;
        if (opacity > 0.8) {
          glowIntensity = isTerminal ? 0.5 : 0.25;
        }
        return (
          <group key={`p-${pos[0]}-${pos[1]}`}>
            <mesh castShadow position={pos}>
              <sphereGeometry args={[0.032, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.82}
                color={
                  isTerminal
                    ? HOMEOSTASIS_COLORS.phosphateHigh
                    : HOMEOSTASIS_COLORS.atp
                }
                emissive={
                  isTerminal
                    ? HOMEOSTASIS_COLORS.phosphateHigh
                    : HOMEOSTASIS_COLORS.atp
                }
                emissiveIntensity={glowIntensity}
                opacity={opacity}
                roughness={0.2}
                transparent={transparent}
              />
            </mesh>
            {next === undefined ? null : (
              <MolecularStick
                color={HOMEOSTASIS_COLORS.atp}
                end={next}
                opacity={opacity}
                radius={0.009}
                start={pos}
              />
            )}
          </group>
        );
      })}
      {mode === "adp" ? (
        <mesh castShadow position={[0.28, 0.075, 0.03]}>
          <sphereGeometry args={[0.028, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.85}
            color={HOMEOSTASIS_COLORS.phosphateHigh}
            emissive={HOMEOSTASIS_COLORS.phosphateHigh}
            emissiveIntensity={opacity > 0.8 ? 0.55 : 0}
            opacity={opacity}
            roughness={0.18}
            transparent={transparent}
          />
        </mesh>
      ) : null}
    </group>
  );
}
