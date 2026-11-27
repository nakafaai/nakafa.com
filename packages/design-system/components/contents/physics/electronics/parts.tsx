import {
  Lead,
  Post,
} from "@repo/design-system/components/contents/physics/bench/lead";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/** Where the leads of the transistor's carrier meet it: its base, collector and emitter posts, on the board. */
const TRANSISTOR_POSTS = {
  base: [-0.24, 0, 0],
  collector: [0.2, 0, -0.17],
  emitter: [0.2, 0, 0.17],
} as const;

const LEGS = [
  [
    [-0.03, 0.2, 0],
    [-0.1, 0.1, 0],
    [-0.24, 0.1, 0],
  ],
  [
    [0, 0.2, 0],
    [0.06, 0.1, -0.08],
    [0.2, 0.1, -0.17],
  ],
  [
    [0.03, 0.2, 0],
    [0.08, 0.1, 0.08],
    [0.2, 0.1, 0.17],
  ],
] as const;

/** The moulded body of a small-signal transistor: a short cylinder with one flat face, which carries its type number. */
function mould() {
  const outline = new Shape();
  outline.absarc(0, 0, 0.075, -Math.PI * 0.18, Math.PI * 1.18, false);
  outline.closePath();
  const body = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    curveSegments: 28,
    depth: 0.13,
  });
  body.rotateX(-Math.PI / 2);
  return body;
}

/**
 * An npn transistor on its carrier: the moulded black body with its flat face
 * forward, standing on three legs that fan out to a base post on the left
 * and a collector and an emitter post on the right.
 */
export function Transistor() {
  const body = useMemo(mould, []);
  useEffect(() => () => body.dispose(), [body]);

  return (
    <group>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[0.66, 0.024, 0.56]} />
        <Matter of="bakelite" />
      </mesh>
      <mesh castShadow geometry={body} position={[0, 0.2, 0]}>
        <Matter color={APPARATUS_COLORS.transistorBody} of="epoxy" />
      </mesh>
      {Arr.map(LEGS, (leg) => (
        <Lead
          color={APPARATUS_COLORS.nickel}
          key={leg[2][2]}
          points={leg}
          radius={0.008}
        />
      ))}
      <Post
        color={APPARATUS_COLORS.leadYellow}
        position={TRANSISTOR_POSTS.base}
      />
      <Post
        color={APPARATUS_COLORS.leadRed}
        position={TRANSISTOR_POSTS.collector}
      />
      <Post
        color={APPARATUS_COLORS.leadBlack}
        position={TRANSISTOR_POSTS.emitter}
      />
    </group>
  );
}

/**
 * A 5 mm indicator lamp standing on its two legs: a tinted epoxy dome over a
 * flange, which shines in its `color` while `lit` and shows the same tint,
 * dull, when it is off.
 */
export function Led({
  color,
  lit,
}: {
  readonly color: string;
  readonly lit: boolean;
}) {
  return (
    <group>
      {Arr.map([-0.018, 0.018] as const, (x) => (
        <mesh key={x} position={[x, 0.04, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.08, 8]} />
          <Matter of="nickel" />
        </mesh>
      ))}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.012, 24]} />
        <Matter color={color} glow={lit ? 0.45 : 0} of="epoxy" opacity={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.125, 0]}>
        <capsuleGeometry args={[0.044, 0.07, 10, 24]} />
        <Matter
          color={color}
          glow={lit ? 1.6 : 0}
          of="epoxy"
          opacity={lit ? 0.96 : 0.7}
        />
        <Shine color={color} glow={lit ? 1.6 : 0} of="epoxy" />
      </mesh>
    </group>
  );
}

/** Where the leads of the light-dependent resistor's carrier meet it, on the board. */
const LDR_POSTS = [
  [0, 0, -0.2],
  [0, 0, 0.2],
] as const;

const TRACKS = [-0.06, -0.03, 0, 0.03, 0.06] as const;

/**
 * A light-dependent resistor on its carrier, its window facing up: a ceramic
 * disc with the pale zigzag track of cadmium sulphide under a clear cover,
 * between two binding posts.
 */
export function Ldr() {
  return (
    <group>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[0.34, 0.024, 0.56]} />
        <Matter of="bakelite" />
      </mesh>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.07, 36]} />
        <Matter of="nickel" />
      </mesh>
      <mesh position={[0, 0.097, 0]}>
        <cylinderGeometry args={[0.098, 0.098, 0.006, 36]} />
        <Matter color={APPARATUS_COLORS.ldrFace} of="ceramic" />
      </mesh>
      {Arr.map(TRACKS, (z, index) => (
        <mesh
          key={z}
          position={[0, 0.101, z]}
          rotation={[0, index % 2 === 0 ? 0.16 : -0.16, 0]}
        >
          <boxGeometry args={[0.15 - Math.abs(z) * 0.9, 0.003, 0.012]} />
          <Matter color={APPARATUS_COLORS.ldrTrack} of="paint" />
        </mesh>
      ))}
      <mesh position={[0, 0.108, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.01, 36]} />
        <Matter of="glass" opacity={0.2} />
      </mesh>
      <Post color={APPARATUS_COLORS.leadYellow} position={LDR_POSTS[0]} />
      <Post color={APPARATUS_COLORS.leadBlack} position={LDR_POSTS[1]} />
    </group>
  );
}

const PINS = [-0.225, -0.15, -0.075, 0, 0.075, 0.15, 0.225] as const;
const ROWS = [-1, 1] as const;

/**
 * A 14-pin logic chip in its dual in-line package, along x: a moulded black
 * body with its notch at the left end, standing on two rows of tinned legs.
 * Its children are the tag that names it.
 */
export function Chip({ children }: { readonly children: ReactNode }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.075, 0]}>
        <boxGeometry args={[0.56, 0.08, 0.2]} />
        <Matter color={APPARATUS_COLORS.chipBody} of="epoxy" />
      </mesh>
      <mesh position={[-0.27, 0.116, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.004, 20]} />
        <Matter color={APPARATUS_COLORS.chipNotch} of="plastic" />
      </mesh>
      {Arr.flatMap(ROWS, (row) =>
        Arr.map(PINS, (x) => (
          <group key={`${row}:${x}`} position={[x, 0, row * 0.112]}>
            <mesh position={[0, 0.07, -row * 0.006]}>
              <boxGeometry args={[0.03, 0.012, 0.03]} />
              <Matter of="solder" />
            </mesh>
            <mesh position={[0, 0.035, row * 0.008]}>
              <boxGeometry args={[0.022, 0.07, 0.008]} />
              <Matter of="solder" />
            </mesh>
          </group>
        ))
      )}
      {children}
    </group>
  );
}

/**
 * A miniature toggle switch: a threaded bush and nut on a steel case, with a
 * chromed lever thrown away from the reader when `on` and toward them when off.
 */
export function Toggle({ on }: { readonly on: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.045, 0]}>
        <boxGeometry args={[0.14, 0.09, 0.16]} />
        <Matter of="steel" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.024, 6]} />
        <Matter of="nickel" />
      </mesh>
      <mesh position={[0, 0.125, 0]}>
        <cylinderGeometry args={[0.028, 0.03, 0.03, 20]} />
        <Matter of="brass" />
      </mesh>
      <group position={[0, 0.13, 0]} rotation={[on ? -0.5 : 0.5, 0, 0]}>
        <mesh castShadow position={[0, 0.075, 0]}>
          <capsuleGeometry args={[0.016, 0.13, 8, 16]} />
          <Matter of="nickel" />
        </mesh>
      </group>
    </group>
  );
}
