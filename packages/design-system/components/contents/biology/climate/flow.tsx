import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { Array as Arr, Schema } from "effect";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A tube of light: each vertex carries how far along its path it lies, which
 * moves the pulses, and how much of its brightness it keeps, which lets a
 * ray fade into space. Its edges dim as they turn from the camera, so the
 * tube reads as a soft beam rather than a solid rod.
 */
const FLOW_VERTEX = /* glsl */ `
attribute float along;
attribute float fade;
varying float vAlong;
varying float vFade;
varying vec3 vNormal;
varying vec3 vView;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  vAlong = along;
  vFade = fade;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FLOW_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float spacing;
uniform float speed;
uniform float strength;
uniform float time;
varying float vAlong;
varying float vFade;
varying vec3 vNormal;
varying vec3 vView;

void main() {
  float face = abs(dot(normalize(vNormal), normalize(vView)));
  float core = 0.25 + 0.75 * pow(face, 1.6);
  float phase = fract(vAlong / spacing - time * speed);
  float pulse = 0.45 + 0.55 * smoothstep(0.0, 0.18, phase) *
    (1.0 - smoothstep(0.32, 1.0, phase));
  gl_FragColor = vec4(color * strength * core * pulse * vFade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** A soft round glow on a camera-facing square, breathing slowly. */
const HALO_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HALO_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float strength;
uniform float time;
varying vec2 vUv;

void main() {
  float r = length(vUv * 2.0 - 1.0);
  float glow = exp(-r * r * 4.5) * (1.0 - smoothstep(0.7, 1.0, r));
  float breath = 0.78 + 0.22 * sin(time * 2.2);
  gl_FragColor = vec4(color * strength * glow * breath, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Advances the `time` uniform of `material` with the clock, unless the
 * reader asks for reduced motion, and disposes of it when it leaves.
 */
export function useClock(material: ShaderMaterial) {
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  useFrame((_, delta) => {
    const time = material.uniforms.time;
    if (calm || time === undefined) {
      return;
    }
    time.value += delta;
  });
  useEffect(() => () => material.dispose(), [material]);
}

/** A material that adds its light to what lies behind it. */
function glowing(vertexShader: string, fragmentShader: string) {
  return {
    blending: AdditiveBlending,
    depthWrite: false,
    fragmentShader,
    transparent: true,
    vertexShader,
  };
}

/**
 * The material of a beam or ribbon of light in `color`, `strength` times as
 * bright as the colour, with pulses `spacing` apart that run along it at
 * `speed` spacings a second.
 */
export function useFlowMaterial(
  color: string,
  strength: number,
  spacing: number,
  speed: number
) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        ...glowing(FLOW_VERTEX, FLOW_FRAGMENT),
        uniforms: {
          color: { value: new Color(color) },
          spacing: { value: spacing },
          speed: { value: speed },
          strength: { value: strength },
          time: { value: 0 },
        },
      }),
    [color, spacing, speed, strength]
  );
  useClock(material);
  return material;
}

/** The material of a soft breathing glow in `color`, `strength` times as bright. */
export function useHaloMaterial(color: string, strength: number) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        ...glowing(HALO_VERTEX, HALO_FRAGMENT),
        uniforms: {
          color: { value: new Color(color) },
          strength: { value: strength },
          time: { value: 0 },
        },
      }),
    [color, strength]
  );
  useClock(material);
  return material;
}

/** A path of light: its sample points, where it starts, and how it ends. */
const TubePathSchema = Schema.Struct({
  fades: Schema.Boolean,
  length: Schema.Finite,
  offset: Schema.Finite,
  points: Schema.Array(
    Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])
  ),
});

/**
 * One merged tube of `radius` along every path, so all of a kind of light is
 * one draw call. A path is its sample points, how far its whole ray had run
 * before it started and how long it is, which keep the pulses running on
 * across a kink, and whether it fades out toward its end.
 */
export function useTubes(
  paths: readonly (typeof TubePathSchema.Type)[],
  radius: number
) {
  const geometry = useMemo(() => {
    const tubes = Arr.map(paths, (path) => {
      const curve = new CatmullRomCurve3(
        Arr.map(path.points, ([x, y, z]) => new Vector3(x, y, z)),
        false,
        "centripetal"
      );
      const tube = new TubeGeometry(
        curve,
        Math.max(4, path.points.length * 2),
        radius,
        8,
        false
      );
      const uv = tube.getAttribute("uv");
      const shares = Arr.map(Arr.range(0, uv.count - 1), (index) =>
        uv.getX(index)
      );
      const along = Arr.map(
        shares,
        (share) => path.offset + share * path.length
      );
      // A fading path keeps its light for the first half, then lets it go.
      const fade = Arr.map(shares, (share) =>
        path.fades ? 1 - smoothstep(0.45, 1, share) : 1
      );
      tube.setAttribute(
        "along",
        new BufferAttribute(new Float32Array(along), 1)
      );
      tube.setAttribute("fade", new BufferAttribute(new Float32Array(fade), 1));
      return tube;
    });
    const merged = mergeGeometries([...tubes]);
    Arr.forEach(tubes, (tube) => tube.dispose());
    return merged;
  }, [paths, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Hermite smoothstep of `value` between `low` and `high`. */
function smoothstep(low: number, high: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
