import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Turn } from "@repo/design-system/components/three/form/part";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";

const THYLAKOID_PROFILE = [
  [0, -0.018],
  [0.125, -0.018],
  [0.145, -0.012],
  [0.15, 0],
  [0.145, 0.012],
  [0.125, 0.018],
  [0, 0.018],
] as const;

const GRANA = [
  { discs: 6, id: "g1", x: -0.64, z: -0.14 },
  { discs: 7, id: "g2", x: -0.26, z: 0.16 },
  { discs: 5, id: "g3", x: 0.14, z: -0.18 },
  { discs: 6, id: "g4", x: 0.48, z: 0.1 },
  { discs: 4, id: "g5", x: -0.06, z: -0.34 },
] as const;

const STARCH_GRAINS = [
  {
    id: "st1",
    pos: [0.68, 0.34, -0.14] as const,
    scale: [1.35, 0.82, 0.95] as const,
  },
  {
    id: "st2",
    pos: [0.54, 0.28, -0.32] as const,
    scale: [1.1, 0.72, 0.85] as const,
  },
] as const;

const PLASTOGLOBULI = [
  { id: "pg1", pos: [-0.46, 0.32, 0.24] as const, r: 0.044 },
  { id: "pg2", pos: [-0.36, 0.27, 0.3] as const, r: 0.032 },
  { id: "pg3", pos: [0.28, 0.29, 0.26] as const, r: 0.038 },
  { id: "pg4", pos: [-0.78, 0.34, 0.08] as const, r: 0.03 },
] as const;

const RIBOSOMES = Arr.makeBy(18, (i) => ({
  id: `rib-${i}`,
  pos: [
    -0.8 + hashUnit(i, 1) * 1.56,
    0.26 + hashUnit(i, 2) * 0.22,
    -0.32 + hashUnit(i, 3) * 0.62,
  ] as const,
}));

/** Double-membrane chloroplast cutaway shell with glossy outer & inner phospholipid envelopes. */
export function ChloroplastEnvelope({
  stromaActive,
}: {
  readonly stromaActive: boolean;
}) {
  const { innerShell, outerShell } = useMemo(() => {
    const outer = new SphereGeometry(
      0.95,
      56,
      36,
      0,
      Math.PI * 2,
      Math.PI * 0.46,
      Math.PI * 0.54
    );
    const inner = new SphereGeometry(
      0.885,
      48,
      30,
      0,
      Math.PI * 2,
      Math.PI * 0.47,
      Math.PI * 0.53
    );
    return { innerShell: inner, outerShell: outer };
  }, []);
  useEffect(
    () => () => {
      outerShell.dispose();
      innerShell.dispose();
    },
    [innerShell, outerShell]
  );

  return (
    <group position={[0, 0.48, 0]}>
      {/* Outer phospholipid membrane */}
      <mesh
        castShadow
        geometry={outerShell}
        receiveShadow
        scale={[1.38, 0.54, 0.8]}
      >
        <meshPhysicalMaterial
          clearcoat={0.78}
          clearcoatRoughness={0.22}
          color={FOLIAGE_COLORS.chloroplast}
          roughness={0.34}
          side={DoubleSide}
        />
      </mesh>
      {/* Inner phospholipid membrane */}
      <mesh geometry={innerShell} scale={[1.38, 0.54, 0.8]}>
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={FOLIAGE_COLORS.chloroplastInner}
          roughness={0.42}
          side={DoubleSide}
        />
      </mesh>
      {/* Cut double-envelope rim ring */}
      <mesh
        position={[0, 0.055, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1.38, 0.8, 1]}
      >
        <torusGeometry args={[0.91, 0.032, 14, 64]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={FOLIAGE_COLORS.chloroplastRim}
          roughness={0.35}
        />
      </mesh>
      {/* Translucent aqueous stroma pool */}
      <mesh
        position={[0, -0.22, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.32, 0.76, 1]}
      >
        <circleGeometry args={[0.84, 48]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={FOLIAGE_COLORS.stroma}
          opacity={stromaActive ? 0.74 : 0.48}
          roughness={0.3}
          transparent
        />
      </mesh>
    </group>
  );
}

/** Stacked coin-like grana thylakoids, curved stromal lamellae, starch, plastoglobuli, cpDNA, and ribosomes. */
export function ChloroplastInterior({
  granaActive,
}: {
  readonly granaActive: boolean;
}) {
  const { dnaGeo, lamellae } = useMemo(() => {
    const bridges = [
      new CatmullRomCurve3([
        new Vector3(-0.52, 0.36, -0.1),
        new Vector3(-0.42, 0.39, 0.04),
        new Vector3(-0.32, 0.4, 0.14),
      ]),
      new CatmullRomCurve3([
        new Vector3(-0.14, 0.44, 0.12),
        new Vector3(0.0, 0.41, -0.02),
        new Vector3(0.1, 0.39, -0.14),
      ]),
      new CatmullRomCurve3([
        new Vector3(0.24, 0.38, -0.12),
        new Vector3(0.36, 0.39, 0.0),
        new Vector3(0.44, 0.42, 0.08),
      ]),
      new CatmullRomCurve3([
        new Vector3(-0.56, 0.44, -0.18),
        new Vector3(-0.32, 0.42, -0.28),
        new Vector3(-0.12, 0.38, -0.34),
      ]),
    ];
    const tubes = Arr.map(bridges, (curve, index) => ({
      geo: new TubeGeometry(curve, 16, 0.018, 10, false),
      id: `lam-${index}`,
    }));
    // Circular chloroplast DNA loop
    const dna = new TorusGeometry(0.11, 0.011, 10, 40);
    return { dnaGeo: dna, lamellae: tubes };
  }, []);

  useEffect(
    () => () => {
      dnaGeo.dispose();
      Arr.forEach(lamellae, ({ geo }) => geo.dispose());
    },
    [dnaGeo, lamellae]
  );

  return (
    <group>
      {/* Stacked thylakoid coin discs */}
      {Arr.map(GRANA, (stack) => (
        <group key={stack.id} position={[stack.x, 0.25, stack.z]}>
          {Arr.makeBy(stack.discs, (idx) => (
            <mesh
              castShadow
              key={`${stack.id}-${idx}`}
              position={[0, idx * 0.046, 0]}
            >
              <Turn profile={THYLAKOID_PROFILE} />
              <meshPhysicalMaterial
                clearcoat={0.55}
                clearcoatRoughness={0.24}
                color={
                  granaActive
                    ? FOLIAGE_COLORS.thylakoid
                    : FOLIAGE_COLORS.chloroplastInner
                }
                emissive={FOLIAGE_COLORS.thylakoidHighlight}
                emissiveIntensity={granaActive ? 0.16 : 0.02}
                roughness={0.34}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Curved stromal lamellae bridges */}
      {Arr.map(lamellae, ({ geo, id }) => (
        <mesh castShadow geometry={geo} key={id}>
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={FOLIAGE_COLORS.thylakoidHighlight}
            roughness={0.38}
          />
        </mesh>
      ))}

      {/* Ivory starch granules */}
      {Arr.map(STARCH_GRAINS, (grain) => (
        <mesh
          castShadow
          key={grain.id}
          position={grain.pos}
          scale={grain.scale}
        >
          <sphereGeometry args={[0.095, 20, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.25}
            color={FOLIAGE_COLORS.starchGranule}
            roughness={0.48}
          />
        </mesh>
      ))}

      {/* Golden lipid plastoglobuli droplets */}
      {Arr.map(PLASTOGLOBULI, (glob) => (
        <mesh castShadow key={glob.id} position={glob.pos}>
          <sphereGeometry args={[glob.r, 16, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.85}
            color={FOLIAGE_COLORS.plastoglobule}
            roughness={0.18}
          />
        </mesh>
      ))}

      {/* Circular cpDNA plasmid loop */}
      <mesh
        geometry={dnaGeo}
        position={[0.78, 0.3, 0.18]}
        rotation={[Math.PI / 2 - 0.15, 0.2, 0]}
      >
        <meshStandardMaterial
          color={FOLIAGE_COLORS.cpDna}
          emissive={FOLIAGE_COLORS.cpDna}
          emissiveIntensity={0.2}
          roughness={0.34}
        />
      </mesh>

      {/* Scattered 70S chloroplast ribosomes */}
      {Arr.map(RIBOSOMES, (rib) => (
        <mesh key={rib.id} position={rib.pos}>
          <sphereGeometry args={[0.015, 8, 6]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.ribosome}
            roughness={0.62}
          />
        </mesh>
      ))}
    </group>
  );
}
