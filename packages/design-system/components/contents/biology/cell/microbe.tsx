import { useFrame } from "@react-three/fiber";
import {
  budShare,
  isDividing,
  spotInHalf,
} from "@repo/design-system/components/contents/biology/cell/anatomy";
import {
  Mitochondria,
  Ribosomes,
} from "@repo/design-system/components/contents/biology/cell/eukaryote";
import { HalfShell } from "@repo/design-system/components/contents/biology/cell/parts";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, DoubleSide, type Group, Vector3 } from "three";

/** One micrometre of a 5 µm yeast cell drawn 2 units long. */
const YEAST_UM = 1 / 2.5;

/** The yeast mother's half sizes: 5 by 4 by 4 µm. */
const MOTHER = [1, 0.8, 0.8] as const;

/**
 * A baker's yeast cell, cut open: a thick wall of glucans with chitin, the
 * membrane inside it, a nucleus about 2 µm across, a vacuole, mitochondria
 * and ribosomes. At `minutes` into its cycle a bud swells at one end; late in
 * the cycle the nucleus stretches into the neck to divide.
 */
export function YeastCell({ minutes }: { readonly minutes: number }) {
  const share = budShare(minutes);
  const dividing = isDividing(minutes);
  const neck = MOTHER[0] * 0.92;

  return (
    <group position={[-share * 0.45, 0, 0]}>
      <HalfShell
        color={MATERIAL.chitin}
        roughness={0.75}
        scale={MOTHER}
        thickness={0.07}
      />
      <group scale={[0.93, 0.93, 0.93]}>
        <HalfShell color={MATERIAL.yeastCell} scale={MOTHER} thickness={0.02} />
      </group>
      <mesh
        castShadow
        position={[dividing ? neck - 0.12 : 0.05, 0.05, -0.38]}
        scale={dividing ? [1.7, 0.75, 0.75] : [1, 1, 1]}
      >
        <sphereGeometry args={[1 * YEAST_UM, 32, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={MATERIAL.nucleus}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[-0.42, -0.12, -0.36]}>
        <sphereGeometry args={[0.9 * YEAST_UM, 32, 24]} />
        <meshPhysicalMaterial
          color={MATERIAL.vacuole}
          opacity={0.7}
          roughness={0.15}
          transparent
        />
      </mesh>
      <group scale={MOTHER}>
        <Mitochondria count={7} margin={0.25} size={YEAST_UM} />
        <Ribosomes count={260} margin={0.12} size={YEAST_UM} />
      </group>
      {share > 0 && (
        <group
          position={[neck + share * 0.78, 0, 0]}
          scale={[share, share, share]}
        >
          <HalfShell
            color={MATERIAL.chitin}
            roughness={0.75}
            scale={MOTHER}
            thickness={0.07}
          />
          <group scale={[0.92, 0.92, 0.92]}>
            <HalfShell
              color={MATERIAL.yeastCell}
              scale={MOTHER}
              thickness={0.02}
            />
          </group>
        </group>
      )}
    </group>
  );
}

/** One micrometre of a 2 µm Escherichia coli rod drawn 2 units long. */
const ROD_UM = 1;

/** The rod's radius and the length of its straight middle, in drawing units. */
const ROD = { middle: 1, radius: 0.5 } as const;

/**
 * An Escherichia coli rod 2 µm long and 1 µm wide, cut open: its wall and
 * membrane, a tangled loop of DNA in the nucleoid with no membrane around it,
 * a small plasmid, ribosomes 25 nm across packed through the cytoplasm, and
 * one flagellum that turns while `playing`.
 */
export function BacteriumCell({ playing }: { readonly playing: boolean }) {
  return (
    <group>
      <RodShell color={MATERIAL.cellBody} radius={ROD.radius} roughness={0.7} />
      <RodShell
        color={MATERIAL.membrane}
        radius={ROD.radius * 0.9}
        roughness={0.5}
      />
      <Nucleoid />
      <mesh position={[0.45, -0.18, -0.2]} rotation={[0.4, 0.2, 0]}>
        <torusGeometry args={[0.07, 0.008, 8, 32]} />
        <meshStandardMaterial color={MATERIAL.nucleolus} roughness={0.5} />
      </mesh>
      <group
        scale={[
          ROD.middle / 2 + ROD.radius * 0.85,
          ROD.radius * 0.85,
          ROD.radius * 0.85,
        ]}
      >
        <Ribosomes count={520} margin={0.08} size={ROD_UM} />
      </group>
      <Flagellum playing={playing} />
    </group>
  );
}

/** The back half of a capsule lying along x: a half tube and two quarter domes. */
function RodShell({
  color,
  radius,
  roughness,
}: {
  readonly color: string;
  readonly radius: number;
  readonly roughness: number;
}) {
  const half = ROD.middle / 2;
  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[radius, radius, ROD.middle, 64, 1, true, Math.PI / 2, Math.PI]}
        />
        <meshPhysicalMaterial
          color={color}
          roughness={roughness}
          side={DoubleSide}
        />
      </mesh>
      <mesh castShadow position={[half, 0, 0]}>
        <sphereGeometry args={[radius, 48, 32, Math.PI, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={color}
          roughness={roughness}
          side={DoubleSide}
        />
      </mesh>
      <mesh castShadow position={[-half, 0, 0]}>
        <sphereGeometry args={[radius, 48, 32, Math.PI * 1.5, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={color}
          roughness={roughness}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** The chromosome: one long loop of DNA folded into a tangle in the middle. */
function Nucleoid() {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(Arr.range(0, 39), (index) => {
          const [x, y, z] = spotInHalf(index, 51, 0.15);
          return new Vector3(x * 0.55, y * 0.3, z * 0.3);
        }),
        true
      ),
    []
  );
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 400, 0.012, 6, true]} />
      <meshStandardMaterial color={MATERIAL.nucleolus} roughness={0.5} />
    </mesh>
  );
}

/** A flagellum: a helical filament about 4 µm long that spins while playing. */
function Flagellum({ playing }: { readonly playing: boolean }) {
  const group = useRef<Group>(null);
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(Arr.range(0, 80), (step) => {
          const along = step / 80;
          const angle = along * Math.PI * 2 * 3;
          return new Vector3(
            -along * 2.5,
            Math.cos(angle) * 0.12,
            Math.sin(angle) * 0.12 - 0.1
          );
        })
      ),
    []
  );

  useFrame((_, delta) => {
    if (playing && group.current) {
      group.current.rotation.x += Math.min(delta, 0.1) * 12;
    }
  });

  return (
    <group position={[-ROD.middle / 2 - ROD.radius, 0, 0]} ref={group}>
      <mesh castShadow>
        <tubeGeometry args={[curve, 240, 0.01, 6, false]} />
        <meshStandardMaterial color={MATERIAL.cellBody} roughness={0.6} />
      </mesh>
    </group>
  );
}
