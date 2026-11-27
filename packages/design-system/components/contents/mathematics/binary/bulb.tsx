import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  filamentSettled,
  heatFilament,
} from "@repo/design-system/components/contents/mathematics/binary/filament";
import {
  filamentPath,
  GLOBE,
  GLOBE_CENTRE,
  globeOutline,
  LEADS,
} from "@repo/design-system/components/contents/mathematics/binary/globe";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { LAMP_COLORS } from "@repo/design-system/lib/material/lamp";
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

/** The porcelain batten holder an E27 bulb screws into, in metres. */
export const HOLDER = {
  body: { height: 0.026, radius: 0.0185 },
  flange: { height: 0.008, radius: 0.026 },
} as const;

/** How high the holder lifts the foot of the bulb's cap. */
export const HOLDER_HEIGHT = HOLDER.flange.height + HOLDER.body.height;

/** How bright a fully lit filament glows, in multiples of a lit white surface; bloom starts at two. */
const FILAMENT_BRIGHTNESS = 14;

/** How strongly a fully lit globe's glass glows with the light inside it. */
const GLASS_GLOW = 0.2;

/** How wide the halo around a lit globe spreads, in metres across. */
const HALO_SIZE = 0.2;

/** The halo of a lit globe: light that fades from the bulb's centre to nothing at the edge. */
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
  float a = strength * pow(max(0.0, 1.0 - r), 2.6);
  gl_FragColor = vec4(color * a, a);
}`;

/** The cold, dim and hot colours of the filament and the glow of the lit glass, built once. */
const SHADES = {
  cold: new Color(LAMP_COLORS.filamentCold),
  dim: new Color(LAMP_COLORS.filamentDim),
  glow: new Color(LAMP_COLORS.glow),
  hot: new Color(LAMP_COLORS.filamentHot),
};

/**
 * One clear G45 globe bulb standing in its porcelain holder, its tungsten
 * filament warming up when its switch turns on and cooling when it turns
 * off. A lit bulb lights its glass from within, throws a soft halo and
 * lights the panel around it.
 */
export function GlobeBulb({ on }: { readonly on: boolean }) {
  const glow = useRef(on ? 1 : 0);
  const filament = useRef<MeshPhysicalMaterial>(null);
  const glass = useRef<MeshPhysicalMaterial>(null);
  const envelope = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(
          globeOutline(),
          ([radius, height]) => new Vector2(radius, height)
        ),
        48
      ),
    []
  );
  const coil = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3(
          Arr.map(filamentPath(), ([x, y]) => new Vector3(x, y, 0))
        ),
        48,
        0.000_75,
        8,
        false
      ),
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
          color: { value: new Color(LAMP_COLORS.glow) },
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

  // A bulb heats before its light reads its glow.
  useFrame((state, delta) => {
    glow.current = heatFilament(glow.current, on, Math.min(delta, 0.1));
    const level = glow.current;
    const shade = filament.current;
    if (shade !== null) {
      shade.emissive.copy(SHADES.dim).lerp(SHADES.hot, Math.sqrt(level));
      shade.emissiveIntensity = FILAMENT_BRIGHTNESS * level ** 1.6;
      shade.color.copy(SHADES.cold);
    }
    if (glass.current !== null) {
      glass.current.emissive.copy(SHADES.glow);
      glass.current.emissiveIntensity = GLASS_GLOW * level;
    }
    const strength = halo.uniforms.strength;
    if (strength !== undefined) {
      strength.value = level;
    }
    if (!filamentSettled(level, on)) {
      state.invalidate();
    }
  }, -1);

  const lead = (side: -1 | 1) => {
    const foot = new Vector3(side * LEADS.foot.spread, LEADS.foot.height, 0);
    const tip = new Vector3(side * LEADS.tip.spread, LEADS.tip.height, 0);
    return { foot, length: foot.distanceTo(tip), tip };
  };

  return (
    <group>
      <Holder />
      <group position={[0, HOLDER_HEIGHT, 0]}>
        <ScrewCap />
        <mesh geometry={envelope} renderOrder={2}>
          <Matter of="glass" opacity={0.12} ref={glass} />
        </mesh>
        <mesh
          position={[0, GLOBE.cap.height + GLOBE.stem.top / 2, 0]}
          renderOrder={1}
        >
          <cylinderGeometry
            args={[
              GLOBE.stem.radius * 0.8,
              GLOBE.stem.radius,
              GLOBE.stem.top,
              12,
            ]}
          />
          <Matter of="glass" />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => {
          const wire = lead(side);
          const middle = wire.foot.clone().lerp(wire.tip, 0.5);
          const tilt = Math.atan2(
            wire.tip.x - wire.foot.x,
            wire.tip.y - wire.foot.y
          );
          return (
            <mesh
              key={side}
              position={middle.toArray()}
              rotation={[0, 0, -tilt]}
            >
              <cylinderGeometry args={[0.000_28, 0.000_28, wire.length, 6]} />
              <Matter of="solder" />
            </mesh>
          );
        })}
        <mesh
          position={[0, (LEADS.foot.height + GLOBE_CENTRE + 0.0045) / 2, 0]}
        >
          <cylinderGeometry
            args={[
              0.000_22,
              0.000_22,
              GLOBE_CENTRE + 0.0045 - LEADS.foot.height,
              6,
            ]}
          />
          <Matter of="solder" />
        </mesh>
        <mesh geometry={coil}>
          <Matter of="tungsten" ref={filament} />
          <Shine glow={1} level={glow} of="tungsten" />
        </mesh>
        <CameraBounds exclude>
          <Billboard position={[0, GLOBE_CENTRE, 0]}>
            <mesh material={halo} renderOrder={3}>
              <planeGeometry args={[HALO_SIZE, HALO_SIZE]} />
            </mesh>
          </Billboard>
        </CameraBounds>
      </group>
    </group>
  );
}

/**
 * The white glazed porcelain batten holder: a round flange screwed to the
 * faceplate and the body the cap screws into, with a small bevel at its rim.
 */
function Holder() {
  return (
    <group>
      <mesh
        castShadow
        position={[0, HOLDER.flange.height / 2, 0]}
        receiveShadow
      >
        <cylinderGeometry
          args={[
            HOLDER.flange.radius * 0.94,
            HOLDER.flange.radius,
            HOLDER.flange.height,
            40,
          ]}
        />
        <Matter of="porcelain" />
      </mesh>
      <mesh
        castShadow
        position={[0, HOLDER.flange.height + HOLDER.body.height / 2, 0]}
        receiveShadow
      >
        <cylinderGeometry
          args={[
            HOLDER.body.radius * 0.96,
            HOLDER.body.radius,
            HOLDER.body.height,
            40,
          ]}
        />
        <Matter of="porcelain" />
      </mesh>
      <mesh
        position={[0, HOLDER_HEIGHT - 0.0005, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[HOLDER.body.radius * 0.93, 0.0011, 10, 40]} />
        <Matter of="porcelain" />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={side}
          position={[
            side * HOLDER.flange.radius * 0.72,
            HOLDER.flange.height,
            0,
          ]}
        >
          <cylinderGeometry args={[0.0022, 0.0024, 0.0012, 14]} />
          <Matter of="steel" />
        </mesh>
      ))}
    </group>
  );
}

/** The brass E27 screw cap that shows above the holder, its thread rolled into rings. */
function ScrewCap() {
  return (
    <group>
      <mesh castShadow position={[0, GLOBE.cap.height / 2, 0]}>
        <cylinderGeometry
          args={[GLOBE.cap.radius, GLOBE.cap.radius, GLOBE.cap.height, 32]}
        />
        <Matter of="brass" />
      </mesh>
      {Arr.map(Arr.range(1, 3), (ring) => (
        <mesh
          key={ring}
          position={[0, (ring * GLOBE.cap.height) / 4, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[GLOBE.cap.radius, 0.0009, 8, 32]} />
          <Matter of="brass" />
        </mesh>
      ))}
    </group>
  );
}
