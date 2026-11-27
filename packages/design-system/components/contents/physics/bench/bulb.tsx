import { Turn } from "@repo/design-system/components/three/form/part";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  TubeGeometry,
  Vector3,
} from "three";

/** The height of the filament above the board the lamp stands on. */
const FILAMENT_HEIGHT = 0.335;

const ENVELOPE = [
  [0.048, 0.15],
  [0.052, 0.19],
  [0.075, 0.24],
  [0.115, 0.29],
  [0.14, 0.35],
  [0.135, 0.41],
  [0.105, 0.455],
  [0.06, 0.482],
  [0, 0.49],
] as const;

const THREADS = [0.108, 0.126, 0.144] as const;
const SUPPORTS = [-1, 1] as const;

const COLD = new Color(APPARATUS_COLORS.tungsten);
const HOT = new Color(APPARATUS_COLORS.filamentHot);
const WHITE = new Color(APPARATUS_COLORS.filamentWhite);

/** A coiled tungsten filament from `from` to `to` along the lamp's width, sagging by `droop` at its free end. */
function coil(from: number, to: number, droop: number) {
  const turns = Math.max(2, Math.round(Math.abs(to - from) * 90));
  const steps = turns * 10;
  const points = Arr.makeBy(steps + 1, (index) => {
    const share = index / steps;
    const angle = share * turns * Math.PI * 2;
    return new Vector3(
      from + (to - from) * share,
      FILAMENT_HEIGHT + Math.sin(angle) * 0.011 - droop * share ** 2,
      Math.cos(angle) * 0.011
    );
  });
  return new TubeGeometry(new CatmullRomCurve3(points), steps, 0.0032, 6);
}

/** One of the two stiff wires that carry the filament, rising from the glass stem. */
function support(side: number) {
  return new TubeGeometry(
    new CatmullRomCurve3([
      new Vector3(side * 0.01, 0.16, 0),
      new Vector3(side * 0.014, 0.25, 0),
      new Vector3(side * 0.05, FILAMENT_HEIGHT, 0),
    ]),
    16,
    0.003,
    6
  );
}

/** The colour of tungsten at `glow`: dull grey, then orange, then nearly white. */
function filamentColor(glow: number) {
  const color = new Color();
  if (glow < 0.5) {
    color.copy(COLD).lerp(HOT, glow * 2);
  } else {
    color.copy(HOT).lerp(WHITE, (glow - 0.5) * 2);
  }
  return `#${color.getHexString()}`;
}

/**
 * A filament lamp in a porcelain batten holder: a clear glass envelope on a
 * nickel screw cap, with a coiled tungsten filament strung between two
 * support wires. The filament brightens with `glow` from 0 (cold) to 1 (full
 * brightness) and lights the board around it; a `broken` one hangs in two
 * pieces and stays dark.
 */
export function Bulb({
  broken = false,
  glow,
}: {
  readonly broken?: boolean;
  readonly glow: number;
}) {
  const lit = broken ? 0 : Math.min(1, Math.max(0, glow));
  const filaments = useMemo(
    () =>
      broken
        ? [
            { geometry: coil(-0.05, -0.012, 0.03), key: "left" },
            { geometry: coil(0.05, 0.016, 0.045), key: "right" },
          ]
        : [{ geometry: coil(-0.05, 0.05, 0), key: "whole" }],
    [broken]
  );
  const supports = useMemo(() => Arr.map(SUPPORTS, support), []);
  useEffect(
    () => () => {
      Arr.forEach(filaments, (filament) => filament.geometry.dispose());
    },
    [filaments]
  );
  useEffect(
    () => () => {
      Arr.forEach(supports, (geometry) => geometry.dispose());
    },
    [supports]
  );
  const color = filamentColor(lit);

  return (
    <group>
      <mesh castShadow position={[0, 0.026, 0]} receiveShadow>
        <cylinderGeometry args={[0.105, 0.115, 0.052, 40]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          color={APPARATUS_COLORS.porcelain}
          roughness={0.3}
        />
      </mesh>
      <mesh castShadow position={[0, 0.074, 0]}>
        <cylinderGeometry args={[0.062, 0.07, 0.044, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          color={APPARATUS_COLORS.porcelain}
          roughness={0.3}
        />
      </mesh>
      <mesh castShadow position={[0, 0.126, 0]}>
        <cylinderGeometry args={[0.049, 0.049, 0.062, 28]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.28} />
      </mesh>
      {Arr.map(THREADS, (y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0.12]}>
          <torusGeometry args={[0.049, 0.005, 8, 28]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 0.1, 14]} />
        <GlassMaterial color={APPARATUS_COLORS.lampGlass} opacity={0.42} />
      </mesh>
      {Arr.map(supports, (geometry, index) => (
        <mesh geometry={geometry} key={SUPPORTS[index]}>
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
        </mesh>
      ))}
      {Arr.map(filaments, (filament) => (
        <mesh geometry={filament.geometry} key={filament.key}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={lit * lit * 9}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}
      {lit > 0.02 ? (
        <>
          <mesh position={[0, FILAMENT_HEIGHT, 0]}>
            <sphereGeometry args={[0.085, 24, 18]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color={APPARATUS_COLORS.lampHalo}
              depthWrite={false}
              opacity={0.05 + lit * 0.3}
              toneMapped={false}
              transparent
            />
          </mesh>
          <pointLight
            color={APPARATUS_COLORS.lampHalo}
            distance={2.2}
            intensity={lit * lit * 0.8}
            position={[0, FILAMENT_HEIGHT, 0]}
          />
        </>
      ) : null}
      <mesh castShadow renderOrder={2}>
        <Turn profile={ENVELOPE} />
        <GlassMaterial color={APPARATUS_COLORS.lampGlass} opacity={0.2} />
      </mesh>
      <mesh position={[0, 0.156, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.014, 28]} />
        <meshStandardMaterial color={QUANTUM_COLORS.ceramic} roughness={0.5} />
      </mesh>
    </group>
  );
}
