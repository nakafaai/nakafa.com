import { Turn } from "@repo/design-system/components/three/form/part";
import { matterGlow } from "@repo/design-system/components/three/matter/glow";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

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

/**
 * How much of its glare a lamp at full brightness shows in the air inside
 * its glass. The glare falls far faster than the filament dims, as the light
 * a filament gives does, so a lamp at a dull red heat keeps clear glass.
 */
const GLARE = 0.4;

/** How large the glare is beside the envelope it fills, about the filament. */
const GLARE_SIZE = 0.82;

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

/**
 * A filament lamp in a porcelain batten holder: a clear glass envelope on a
 * nickel screw cap, with a coiled tungsten filament strung between two
 * support wires. The filament brightens with `glow` from 0 (cold) to 1 (full
 * brightness), fills the glass round it with a warm glare of its own colour
 * and lights the board it stands on; a `broken` one hangs in two pieces and
 * stays dark, its glass clear.
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
  const glare = lit ** 4 * GLARE;
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
  return (
    <group>
      <mesh castShadow position={[0, 0.026, 0]} receiveShadow>
        <cylinderGeometry args={[0.105, 0.115, 0.052, 40]} />
        <Matter of="porcelain" />
      </mesh>
      <mesh castShadow position={[0, 0.074, 0]}>
        <cylinderGeometry args={[0.062, 0.07, 0.044, 32]} />
        <Matter of="porcelain" />
      </mesh>
      <mesh castShadow position={[0, 0.126, 0]}>
        <cylinderGeometry args={[0.049, 0.049, 0.062, 28]} />
        <Matter of="nickel" />
      </mesh>
      {Arr.map(THREADS, (y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0.12]}>
          <torusGeometry args={[0.049, 0.005, 8, 28]} />
          <Matter of="nickel" />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 0.1, 14]} />
        <Matter of="glass" opacity={0.42} />
      </mesh>
      {Arr.map(supports, (geometry, index) => (
        <mesh geometry={geometry} key={SUPPORTS[index]}>
          <Matter finish="brushed" of="nickel" />
        </mesh>
      ))}
      <group>
        {Arr.map(filaments, (filament) => (
          <mesh geometry={filament.geometry} key={filament.key}>
            <Matter glow={lit} of="tungsten" />
          </mesh>
        ))}
        <Shine glow={lit} of="tungsten" />
      </group>
      {glare > 0.01 ? (
        <mesh
          position={[0, FILAMENT_HEIGHT * (1 - GLARE_SIZE), 0]}
          scale={GLARE_SIZE}
        >
          <Turn profile={ENVELOPE} />
          <Matter
            color={matterGlow({ glow: lit, of: "tungsten" }).color}
            glow={0.6}
            of="light"
            opacity={glare}
          />
        </mesh>
      ) : null}
      <mesh castShadow renderOrder={2}>
        <Turn profile={ENVELOPE} />
        <Matter of="glass" opacity={0.08} />
      </mesh>
      <mesh position={[0, 0.156, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.014, 28]} />
        <Matter of="porcelain" />
      </mesh>
    </group>
  );
}
