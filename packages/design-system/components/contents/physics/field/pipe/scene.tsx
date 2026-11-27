import { useFrame } from "@react-three/fiber";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { fallThrough } from "@repo/design-system/components/contents/physics/field/magnet";
import {
  DRAG,
  GRAVITY,
  PIPE,
  PIPES,
} from "@repo/design-system/components/contents/physics/field/pipe/drag";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";
import { DoubleSide } from "three";

/** Wall seconds the scene holds after the slowest magnet lands, before all three drop again. */
const HOLD_SECONDS = 1.5;
/** How tall a pipe of one metre stands in the scene, its radius, where its foot is, and how far apart the pipes stand. */
const TALL = 2;
const RADIUS = 0.13;
const FOOT = 0.16;
const SPACING = 0.95;
/** How much of each pipe's wall is cut away toward the reader, so the magnet inside shows. */
const WINDOW = Math.PI * 0.62;

/** The wall of one pipe: what it is made of, and whether a slit runs down its back. */
const WALLS = {
  copper: { color: QUANTUM_COLORS.copper, metal: true, slit: false },
  plastic: { color: APPARATUS_COLORS.plasticPipe, metal: false, slit: false },
  slit: { color: QUANTUM_COLORS.copper, metal: true, slit: true },
} as const;

/** One pipe standing on the base, cut open toward the reader. A slit pipe is drawn in two shells with a gap down its back. */
function Pipe({ kind }: { readonly kind: keyof typeof WALLS }) {
  const wall = WALLS[kind];
  const shells = wall.slit
    ? [
        { key: "left", length: Math.PI - WINDOW / 2 - 0.09, start: WINDOW / 2 },
        {
          key: "right",
          length: Math.PI - WINDOW / 2 - 0.09,
          start: Math.PI + 0.09,
        },
      ]
    : [{ key: "whole", length: Math.PI * 2 - WINDOW, start: WINDOW / 2 }];

  return (
    <group position={[0, FOOT + TALL / 2, 0]}>
      {Arr.map(shells, (shell) => (
        <mesh castShadow key={shell.key}>
          <cylinderGeometry
            args={[
              RADIUS,
              RADIUS,
              TALL,
              48,
              1,
              true,
              shell.start,
              shell.length,
            ]}
          />
          <meshPhysicalMaterial
            clearcoat={wall.metal ? 0 : 0.5}
            color={wall.color}
            metalness={wall.metal ? 1 : 0}
            roughness={wall.metal ? 0.28 : 0.45}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Three pipes of the same size standing in a clamp bar on one base, each cut
 * open toward the reader: plastic, copper, and copper with a slit down its
 * back. While the card plays, the same magnet drops through each from rest
 * at the same moment. Round the copper pipe a glowing ring of eddy current
 * follows the magnet, brighter the faster it falls, and round the slit pipe
 * only a faint broken one.
 */
export function MagnetPipeScene({ longest }: { readonly longest: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(0);
  const magnets = useRef<Group>(null);

  const place = () => {
    const group = magnets.current;
    if (group === null) {
      return;
    }
    Arr.forEach(PIPES, (pipe, index) => {
      const magnet = group.children[index];
      const fall = fallThrough(DRAG[pipe], GRAVITY, clock.current);
      const share = Math.min(1, fall.distance / PIPE);
      if (magnet !== undefined) {
        magnet.position.y = FOOT + TALL - 0.1 - share * (TALL - 0.2);
        const ring = magnet.children[2];
        if (ring !== undefined) {
          ring.visible = share > 0.02 && share < 1 && DRAG[pipe] > 0;
        }
      }
    });
  };

  useVisualStop(() => {
    clock.current = 0;
    place();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current =
      (clock.current + simulationStep(delta)) % (longest + HOLD_SECONDS);
    place();
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.6, 2, 6.4]}
        target={[0, 1.15, 0]}
        wide={[0.7, 1.6, 4.5]}
      />
      <SeamlessBenchSurface />
      <mesh castShadow position={[0, FOOT / 2, 0]} receiveShadow>
        <boxGeometry args={[SPACING * 2 + 0.9, FOOT, 0.8]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={APPARATUS_COLORS.bakeliteBrown}
          roughness={0.5}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * (SPACING + 0.36), FOOT + TALL / 2 + 0.1, -0.2]}
        >
          <cylinderGeometry args={[0.022, 0.022, TALL + 0.2, 14]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.25} />
        </mesh>
      ))}
      <mesh castShadow position={[0, FOOT + TALL * 0.8, -0.2]}>
        <boxGeometry args={[SPACING * 2 + 0.8, 0.06, 0.05]} />
        <MetalMaterial color={APPARATUS_COLORS.caseSteel} roughness={0.4} />
      </mesh>
      {Arr.map(PIPES, (pipe, index) => (
        <group key={pipe} position={[(index - 1) * SPACING, 0, 0]}>
          <Pipe kind={pipe} />
          <mesh position={[0, FOOT + TALL * 0.8, -0.16]}>
            <boxGeometry args={[0.34, 0.07, 0.08]} />
            <MetalMaterial color={APPARATUS_COLORS.caseSteel} roughness={0.4} />
          </mesh>
          <Tag position={[0, FOOT + TALL + 0.24, 0]}>
            <InlineMath math={`${index + 1}`} />
          </Tag>
        </group>
      ))}
      <group ref={magnets}>
        {Arr.map(PIPES, (pipe, index) => (
          <group
            key={pipe}
            position={[(index - 1) * SPACING, FOOT + TALL - 0.1, 0]}
          >
            <mesh castShadow position={[0, 0.04, 0]}>
              <cylinderGeometry
                args={[RADIUS - 0.035, RADIUS - 0.035, 0.08, 32]}
              />
              <meshPhysicalMaterial
                clearcoat={0.6}
                color={APPARATUS_COLORS.poleNorth}
                metalness={0.5}
                roughness={0.3}
              />
            </mesh>
            <mesh castShadow position={[0, -0.04, 0]}>
              <cylinderGeometry
                args={[RADIUS - 0.035, RADIUS - 0.035, 0.08, 32]}
              />
              <MetalMaterial
                color={APPARATUS_COLORS.neodymium}
                roughness={0.2}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} visible={false}>
              <torusGeometry
                args={[
                  RADIUS + 0.03,
                  0.012,
                  10,
                  48,
                  pipe === "slit" ? Math.PI * 1.5 : Math.PI * 2,
                ]}
              />
              <meshStandardMaterial
                color={APPARATUS_COLORS.eddyGlow}
                emissive={APPARATUS_COLORS.eddyGlow}
                emissiveIntensity={pipe === "slit" ? 0.9 : 4}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
