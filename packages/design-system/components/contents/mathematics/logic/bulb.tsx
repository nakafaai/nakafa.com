import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { heat } from "@repo/design-system/components/contents/mathematics/logic/motion";
import {
  BASE_TOP,
  PartBase,
  Post,
} from "@repo/design-system/components/contents/mathematics/logic/parts";
import { PARTS } from "@repo/design-system/components/contents/mathematics/logic/rig";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { LOGIC_COLORS } from "@repo/design-system/lib/material/logic";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { MeshPhysicalMaterial } from "three";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  LatheGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** The nickel screw holder the bulb sits in: its radius and its height above the base. */
const SOCKET = { height: 0.011, radius: 0.0062 } as const;

/** Where the bulb's glass starts: the top of the holder. */
const GLASS_FOOT = BASE_TOP + SOCKET.height;

/** The profile of a 2.5 V torch bulb's glass from the cap up, turned on a lathe. */
const GLASS_OUTLINE = [
  [0.0036, 0],
  [0.0046, 0.0018],
  [0.0055, 0.0048],
  [0.0057, 0.0074],
  [0.0051, 0.0104],
  [0.0034, 0.0127],
  [0.0014, 0.0138],
  [0, 0.0141],
] as const;

/** The height of the coil above the glass foot. */
const COIL_HEIGHT = 0.0072;

/** How bright a lit coil glows, in multiples of a white surface; the stage's bloom starts at two. */
const COIL_BRIGHTNESS = 16;

/** How far the halo of a lit bulb spreads, in metres across. */
const HALO_SIZE = 0.07;

const HALO_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const HALO_FRAGMENT = `
uniform vec3 color;
uniform float strength;
varying vec2 vUv;
void main() {
  float r = distance(vUv, vec2(0.5)) * 2.0;
  float a = strength * pow(max(0.0, 1.0 - r), 2.4);
  gl_FragColor = vec4(color * a, a);
}`;

/** The coil's colours cold, dim and hot and the glow of the lit glass, built once. */
const SHADES = {
  cold: new Color(LOGIC_COLORS.filamentCold),
  dim: new Color(LOGIC_COLORS.filamentDim),
  glow: new Color(LOGIC_COLORS.glow),
  hot: new Color(LOGIC_COLORS.filamentHot),
};

/** A tight tungsten coil lying across the bulb between its two support wires. */
function coilPath() {
  const turns = 9;
  const span = 0.0034;
  return Arr.makeBy(turns * 8 + 1, (step) => {
    const along = step / (turns * 8);
    const around = along * turns * Math.PI * 2;
    return new Vector3(
      -span / 2 + along * span,
      COIL_HEIGHT + Math.sin(around) * 0.0004,
      Math.cos(around) * 0.0004
    );
  });
}

/**
 * A 2.5 V torch bulb screwed into a nickel holder on a black base, between
 * two posts. With current through it the coil warms within a few hundredths
 * of a second to a warm white, lights the glass from within, throws a soft
 * halo and lights the board around it; without, it cools to dark.
 */
export function LampHolder({ lit }: { readonly lit: boolean }) {
  const { depth, length, reach } = PARTS.lamp;
  const level = useRef(lit ? 1 : 0);
  const coilShade = useRef<MeshPhysicalMaterial>(null);
  const glass = useRef<MeshPhysicalMaterial>(null);
  const envelope = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(
          GLASS_OUTLINE,
          ([radius, height]) => new Vector2(radius, height)
        ),
        40
      ),
    []
  );
  const coil = useMemo(
    () => new TubeGeometry(new CatmullRomCurve3(coilPath()), 96, 0.000_12, 6),
    []
  );
  const halo = useMemo(
    () =>
      new ShaderMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        fragmentShader: HALO_FRAGMENT,
        transparent: true,
        uniforms: {
          color: { value: new Color(LOGIC_COLORS.glow) },
          strength: { value: 0 },
        },
        vertexShader: HALO_VERTEX,
      }),
    []
  );
  useEffect(
    () => () => {
      envelope.dispose();
      coil.dispose();
      halo.dispose();
    },
    [coil, envelope, halo]
  );

  useFrame((state, delta) => {
    const next = heat(level.current, lit, Math.min(delta, 0.1));
    level.current = next;
    if (coilShade.current !== null) {
      coilShade.current.emissive
        .copy(SHADES.dim)
        .lerp(SHADES.hot, Math.sqrt(next));
      coilShade.current.emissiveIntensity = COIL_BRIGHTNESS * next ** 1.5;
    }
    if (glass.current !== null) {
      glass.current.emissive.copy(SHADES.glow);
      glass.current.emissiveIntensity = 0.22 * next;
    }
    const strength = halo.uniforms.strength;
    if (strength !== undefined) {
      strength.value = next;
    }
    if (next !== (lit ? 1 : 0)) {
      state.invalidate();
    }
  });

  return (
    <group>
      <PartBase depth={depth} length={length} />
      <mesh castShadow position={[0, BASE_TOP + SOCKET.height / 2, 0]}>
        <cylinderGeometry
          args={[SOCKET.radius, SOCKET.radius * 1.08, SOCKET.height, 28]}
        />
        <Matter of="nickel" />
      </mesh>
      <group position={[0, GLASS_FOOT, 0]}>
        <mesh geometry={envelope} renderOrder={2}>
          <Matter of="glass" opacity={0.16} ref={glass} />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh key={side} position={[side * 0.0017, COIL_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[0.0002, 0.0002, COIL_HEIGHT, 6]} />
            <Matter of="nickel" />
          </mesh>
        ))}
        <mesh geometry={coil}>
          <Matter of="tungsten" ref={coilShade} />
          <Shine glow={1} level={level} of="tungsten" />
        </mesh>
        <CameraBounds exclude>
          <Billboard position={[0, COIL_HEIGHT, 0]}>
            <mesh material={halo} renderOrder={3}>
              <planeGeometry args={[HALO_SIZE, HALO_SIZE]} />
            </mesh>
          </Billboard>
        </CameraBounds>
      </group>
      <Post x={-reach} />
      <Post x={reach} />
    </group>
  );
}
