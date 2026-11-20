import {
  LEFT_ATRIUM,
  LEFT_CAVITY,
  LEFT_WALL,
  RIGHT_ATRIUM,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import type { Moment } from "@repo/design-system/components/contents/biology/heart/circulation";
import type { Beat } from "@repo/design-system/components/contents/biology/heart/cycle";
import { useRequired } from "@repo/design-system/hooks/required";
import type { ReactNode, RefObject } from "react";
import { createContext, useEffect, useMemo } from "react";
import type { MeshPhysicalMaterialParameters } from "three";
import { MeshPhysicalMaterial } from "three";

/**
 * How the muscle stands at one moment, which every tissue of the heart reads
 * in its vertex shader: how far the long axis has shortened (`long`) and the
 * cavity's radius (`radial`) as shares of their diastolic size, how far the
 * right ventricle's free wall has moved in toward the septum (`bellows`, in
 * cm), and the atria's radius as a share of their fullest (`atria`).
 */
export function createPose() {
  return {
    atria: { value: 1 },
    bellows: { value: 0 },
    long: { value: 1 },
    radial: { value: 1 },
  };
}
type Pose = ReturnType<typeof createPose>;

/**
 * How far the right ventricle's free wall moves in toward the septum as the
 * ventricle empties, in cm: a share of the 2.4 cm the tricuspid annulus
 * travels toward the apex (TAPSE 24 ± 3.5 mm, Lang 2015, Table 10), since
 * the free wall moves in as the base moves down.
 */
const BELLOWS = 0.6;

/**
 * Sets the pose for a moment of the beat. The ventricle's volume falls to
 * `share` of its end-diastolic volume, split between the long axis and the
 * cavity's radius so that long × radial² = share: the long axis by the sixth
 * root and the radius by the remaining five twelfths power. At the lab's
 * resting ejection of 58% the base then descends about 1 cm toward the apex
 * and the cavity narrows by 31%, near the 35% the diastolic and systolic
 * diameters of a man's left ventricle give (50.2 and 32.4 mm, Lang 2015,
 * Table 2). The atria follow the left atrium's volume.
 */
export function setPose(
  pose: Pose,
  moment: Moment,
  beat: Beat,
  filled: number
) {
  const share = moment.volume / filled;
  pose.long.value = share ** (1 / 6);
  pose.radial.value = share ** (5 / 12);
  pose.bellows.value = BELLOWS * (1 - share);
  pose.atria.value = Math.cbrt(moment.reserve / beat.reserve.maximum);
}

/** The apex of the outer surface along the long axis, which stays still while the base descends to it. */
const APEX = LEFT_WALL.along + LEFT_WALL.radii[0];

/** A number as a GLSL float literal. */
function glsl(value: number) {
  return value.toFixed(5);
}

/**
 * The beating muscle in GLSL: moves a rest position (end-diastole) to where
 * the pose puts it. The base descends toward the still apex as the long axis
 * shortens, dragging the atria and the roots of the great vessels after it.
 * Round the left ventricle's long axis the cavity shrinks, and the muscle,
 * which keeps its volume, thickens: a point at radius r outside the cavity's
 * diastolic radius R moves to √(r² − R²(1 − radial²)). The right free wall
 * presses toward the septum, and the atria shrink toward their centres.
 */
const BEAT = /* glsl */ `
uniform float uLong;
uniform float uRadial;
uniform float uBellows;
uniform float uAtria;

vec3 atrialPull(vec3 p, vec3 centre, float weight) {
  float near = exp(-dot(p - centre, p - centre) / 6.5) * weight;
  return (centre - p) * (1.0 - uAtria) * near;
}

vec3 beat(vec3 p) {
  vec2 axis = vec2(${glsl(Math.sin((27 * Math.PI) / 180))}, ${glsl(-Math.cos((27 * Math.PI) / 180))});
  vec2 side = vec2(-axis.y, axis.x);
  float along = dot(p.xy, axis);
  float across = dot(p.xy, side);
  float depth = p.z;
  float ventricle = smoothstep(-0.7, 0.5, along);

  float descent = ${glsl(APEX)} * (1.0 - uLong);
  float pull = along >= 0.0
    ? clamp((${glsl(APEX)} - along) / ${glsl(APEX)}, 0.0, 1.0)
    : smoothstep(-4.6, 0.0, along);
  float moved = along + descent * pull;

  vec2 radial = vec2(across - ${glsl(LEFT_CAVITY.across)}, depth - ${glsl(LEFT_CAVITY.depth)});
  float r = length(radial);
  float level = clamp((along - ${glsl(LEFT_CAVITY.along)}) / ${glsl(LEFT_CAVITY.radii[0])}, -1.0, 1.0);
  float inner = ${glsl(LEFT_CAVITY.radii[1])} * sqrt(max(0.0, 1.0 - level * level));
  float squeezed = r < inner
    ? r * uRadial
    : sqrt(max(r * r - inner * inner * (1.0 - uRadial * uRadial), 0.0));
  vec2 shift = (r > 0.0001 ? radial * (squeezed / r) - radial : vec2(0.0)) * ventricle;
  shift.x += uBellows * (1.0 - smoothstep(-4.2, -2.0, across)) * ventricle;

  vec3 result = vec3(axis * moved + side * (across + shift.x), depth + shift.y);
  vec3 rightAtrium = vec3(axis * ${glsl(RIGHT_ATRIUM.along)} + side * ${glsl(RIGHT_ATRIUM.across)}, ${glsl(RIGHT_ATRIUM.depth)});
  vec3 leftAtrium = vec3(axis * ${glsl(LEFT_ATRIUM.along)} + side * ${glsl(LEFT_ATRIUM.across)}, ${glsl(LEFT_ATRIUM.depth)});
  result += atrialPull(p, rightAtrium, 1.0 - ventricle);
  result += atrialPull(p, leftAtrium, 1.0 - ventricle);
  return result;
}
`;

/**
 * The fine relief of living tissue in GLSL: smooth value noise over the
 * rest position, whose slope tilts the shading normal a little, so light
 * breaks into the many small glints of a wet surface instead of one plastic
 * highlight.
 */
const RELIEF = /* glsl */ `
varying vec3 vRest;
uniform float uRelief;

float reliefHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float reliefNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(reliefHash(i), reliefHash(i + vec3(1, 0, 0)), f.x),
        mix(reliefHash(i + vec3(0, 1, 0)), reliefHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(reliefHash(i + vec3(0, 0, 1)), reliefHash(i + vec3(1, 0, 1)), f.x),
        mix(reliefHash(i + vec3(0, 1, 1)), reliefHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float relief(vec3 p) {
  // The finer octave runs on a turned lattice, so no grid shows through.
  mat3 turn = mat3(0.8, 0.6, 0.0, -0.48, 0.64, 0.6, 0.36, -0.48, 0.8);
  return reliefNoise(p * 1.7) * 0.7 + reliefNoise(turn * p * 4.3) * 0.3;
}
`;

/** The heart's shared state: its beat, the clock in seconds into the beat, and the pose its tissues read. */
const PulseContext = createContext<{
  readonly beat: Beat;
  readonly clock: RefObject<number>;
  readonly filled: number;
  readonly pose: Pose;
} | null>(null);

/** Shares one beating heart's state with every part of its scene. */
export function PulseProvider({
  beat,
  children,
  clock,
  filled,
  pose,
}: {
  readonly beat: Beat;
  readonly children: ReactNode;
  readonly clock: RefObject<number>;
  readonly filled: number;
  readonly pose: Pose;
}) {
  const value = useMemo(
    () => ({ beat, clock, filled, pose }),
    [beat, clock, filled, pose]
  );
  return <PulseContext value={value}>{children}</PulseContext>;
}

/** Reads the beating heart's state. */
export function usePulse() {
  return useRequired(PulseContext, "usePulse");
}

/**
 * Where the beat moves a vertex. A body drawn many times over (a drop of
 * blood) moves whole with the point of the heart it sits at: the shift of
 * its centre, turned back into the body's own frame so its own turn and
 * position apply on top, which a pure turn and shift allow.
 */
const INSTANCED = /* glsl */ `
#ifdef USE_INSTANCING
  vec3 bodyCentre = instanceMatrix[3].xyz;
  vec3 transformed = position + transpose(mat3(instanceMatrix)) * (beat(bodyCentre) - bodyCentre);
#else
  vec3 transformed = beat(position);
#endif
vRest = position;
`;

/**
 * A physical material for a tissue of the heart that moves with the beat:
 * its vertices pass through the beating muscle's shader before they are
 * drawn, so every part of the heart moves as one. With `relief`, its surface
 * also takes the fine relief of living tissue, that strong.
 */
export function useTissue(
  parameters: MeshPhysicalMaterialParameters,
  relief = 0
) {
  const { pose } = usePulse();
  const material = useMemo(() => {
    const tissue = new MeshPhysicalMaterial(parameters);
    tissue.onBeforeCompile = (shader) => {
      shader.uniforms.uLong = pose.long;
      shader.uniforms.uRadial = pose.radial;
      shader.uniforms.uBellows = pose.bellows;
      shader.uniforms.uAtria = pose.atria;
      shader.uniforms.uRelief = { value: relief };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>\n${BEAT}\nvarying vec3 vRest;`
        )
        .replace("#include <begin_vertex>", INSTANCED);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${RELIEF}`)
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          if (uRelief > 0.0) {
            float e = 0.03;
            float h = relief(vRest);
            vec3 slope = vec3(
              relief(vRest + vec3(e, 0.0, 0.0)) - h,
              relief(vRest + vec3(0.0, e, 0.0)) - h,
              relief(vRest + vec3(0.0, 0.0, e)) - h
            ) / e;
            vec3 tilt = (viewMatrix * vec4(slope, 0.0)).xyz;
            normal = normalize(normal - uRelief * (tilt - dot(tilt, normal) * normal));
          }`
        );
    };
    tissue.customProgramCacheKey = () => `heart-beat-${relief > 0}`;
    return tissue;
  }, [parameters, pose, relief]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
