import { useFrame } from "@react-three/fiber";
import type { waveVectors } from "@repo/design-system/components/contents/physics/waves/tank/ripple";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { TOWN_COLORS } from "@repo/design-system/lib/material/town";
import { useLayoutEffect, useMemo } from "react";
import { Color, ShaderMaterial } from "three";

/** How many squares the surface is cut into along its longer side: enough that the shortest ripple is round. */
const GRID = 320;

/** How high a crest stands above still water. */
const RISE = 0.016;

const VERTEX = /* glsl */ `
  uniform vec2 uDeep;
  uniform vec2 uShallow;
  uniform vec2 uHalf;
  uniform float uTurn;
  uniform float uRise;
  varying vec2 vPlace;
  varying vec3 vWorld;
  varying float vCalm;

  void main() {
    vPlace = vec2(position.x, -position.y);
    vec2 wave = vPlace.y < 0.0 ? uDeep : uShallow;
    float phase = dot(wave, vPlace) - uTurn;
    vec2 shore = smoothstep(vec2(0.0), vec2(0.22), uHalf - abs(vPlace));
    vCalm = shore.x * shore.y;
    vec3 lifted = position + vec3(0.0, 0.0, uRise * vCalm * cos(phase));
    vec4 world = modelMatrix * vec4(lifted, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Water a few millimetres deep over glass: every crest is a lens that
 * gathers the light onto the floor in a bright line and every trough
 * spreads it, which is the pattern a ripple tank shows, under a surface
 * that mirrors the room at a glancing angle and glints where a slope faces
 * the lamp.
 */
const FRAGMENT = /* glsl */ `
  uniform vec2 uDeep;
  uniform vec2 uShallow;
  uniform float uTurn;
  uniform float uRise;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uGlint;
  varying vec2 vPlace;
  varying vec3 vWorld;
  varying float vCalm;

  void main() {
    vec2 wave = vPlace.y < 0.0 ? uDeep : uShallow;
    float phase = dot(wave, vPlace) - uTurn;
    float slope = -uRise * vCalm * sin(phase);
    vec3 normal = normalize(vec3(-slope * wave.x, 1.0, -slope * wave.y));
    vec3 toEye = normalize(cameraPosition - vWorld);
    float crest = cos(phase);
    float gathered = pow(max(crest, 0.0), 3.0) - 0.35 * pow(max(-crest, 0.0), 2.0);
    float plate = smoothstep(-0.012, 0.012, vPlace.y);
    vec3 floorLight = mix(uDeepColor, uShallowColor, plate);
    floorLight *= 0.78 + 1.05 * vCalm * gathered;
    float glance = pow(1.0 - max(dot(normal, toEye), 0.0), 5.0);
    vec3 lamp = normalize(vec3(0.25, 0.9, 0.35));
    float glint = pow(max(dot(normal, normalize(lamp + toEye)), 0.0), 220.0);
    vec3 seen = mix(floorLight, uGlint, 0.03 + 0.4 * glance) + uGlint * glint * 0.9;
    gl_FragColor = vec4(seen, 0.94);
    #include <colorspace_fragment>
  }
`;

/**
 * The water of a ripple tank, `wide` along the boundary and `deep` across
 * it, lying in the plane of its group with still water at its origin. Its
 * height is the straight wave of `vectors` on both sides of the step in
 * depth, which lies along x through the middle, deep water behind it and
 * shallow water in front. The crests move on while the card plays, one
 * wavelength every `period` seconds, and the surface calms toward the
 * tank's beaches.
 *
 * The surface is one mesh displaced on the graphics card, so a frame only
 * sets the turn of the source and allocates nothing.
 *
 * @param deep - The length of the water across the boundary
 * @param period - Seconds a crest takes to move one wavelength
 * @param vectors - The wave vectors on both sides of the step
 * @param wide - The length of the water along the boundary
 */
export function Water({
  deep,
  period,
  vectors,
  wide,
}: {
  readonly deep: number;
  readonly period: number;
  readonly vectors: ReturnType<typeof waveVectors>;
  readonly wide: number;
}) {
  const clock = useSimulationClock();
  const surface = useMemo(() => {
    const uniforms = {
      uDeep: { value: [0, 1] },
      uDeepColor: { value: new Color(ECOLOGY_COLORS.seawaterDeep) },
      uGlint: { value: new Color(TOWN_COLORS.waterGlint) },
      uHalf: { value: [1, 1] },
      uRise: { value: RISE },
      uShallow: { value: [0, 1] },
      uShallowColor: { value: new Color(ECOLOGY_COLORS.seawater) },
      uTurn: { value: 0 },
    };
    return {
      material: new ShaderMaterial({
        fragmentShader: FRAGMENT,
        toneMapped: false,
        transparent: true,
        uniforms,
        vertexShader: VERTEX,
      }),
      uniforms,
    };
  }, []);

  useLayoutEffect(() => () => surface.material.dispose(), [surface]);
  useLayoutEffect(() => {
    surface.uniforms.uDeep.value = [vectors.deep[0], vectors.deep[1]];
    surface.uniforms.uShallow.value = [vectors.shallow[0], vectors.shallow[1]];
    surface.uniforms.uHalf.value = [wide / 2, deep / 2];
  }, [deep, surface, vectors, wide]);

  useFrame((_, delta) => {
    surface.uniforms.uTurn.value =
      (clock.advance(delta) / period) * 2 * Math.PI;
  });

  return (
    <mesh
      material={surface.material}
      renderOrder={5}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry
        args={[wide, deep, GRID, Math.round((GRID * deep) / wide)]}
      />
    </mesh>
  );
}
