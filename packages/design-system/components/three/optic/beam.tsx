import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Object3D,
  ShaderMaterial,
  Vector3,
} from "three";

type Point = readonly [number, number, number];

/** How many sides the round body of a beam has: enough that its soft edge never shows a facet. */
const SIDES = 20;

/** How much wider than its bright core a beam's halo of scattered light is. */
const HALO = 4.2;

const UP = new Vector3(0, 1, 0);
const from = new Vector3();
const span = new Vector3();
const part = new Object3D();

const VERTEX = /* glsl */ `
  varying vec3 vFacing;
  varying vec3 vToEye;
  varying vec3 vPlace;
  varying float vAlong;

  void main() {
    mat4 placed = modelMatrix * instanceMatrix;
    vec4 place = placed * vec4(position, 1.0);
    vec4 seen = viewMatrix * place;
    vPlace = place.xyz;
    vToEye = -seen.xyz;
    vFacing = mat3(viewMatrix) * mat3(placed) * normal;
    vAlong = (position.y + 0.5) * length(placed[1].xyz);
    gl_Position = projectionMatrix * seen;
  }
`;

/**
 * Light scattered by the dust of still air: brightest where the eye looks
 * through the most of the beam, which is its middle, fading to nothing at
 * its edge, with slow drifting haze and the odd mote that catches the light.
 */
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uSoft;
  uniform float uHot;
  uniform float uDash;
  uniform float uTime;
  varying vec3 vFacing;
  varying vec3 vToEye;
  varying vec3 vPlace;
  varying float vAlong;

  float chance(vec3 cell) {
    cell = fract(cell * 0.3183099 + 0.1) * 17.0;
    return fract(cell.x * cell.y * cell.z * (cell.x + cell.y + cell.z));
  }

  float haze(vec3 place) {
    vec3 cell = floor(place);
    vec3 within = fract(place);
    within = within * within * (3.0 - 2.0 * within);
    return mix(
      mix(
        mix(chance(cell), chance(cell + vec3(1.0, 0.0, 0.0)), within.x),
        mix(chance(cell + vec3(0.0, 1.0, 0.0)), chance(cell + vec3(1.0, 1.0, 0.0)), within.x),
        within.y
      ),
      mix(
        mix(chance(cell + vec3(0.0, 0.0, 1.0)), chance(cell + vec3(1.0, 0.0, 1.0)), within.x),
        mix(chance(cell + vec3(0.0, 1.0, 1.0)), chance(cell + vec3(1.0, 1.0, 1.0)), within.x),
        within.y
      ),
      within.z
    );
  }

  void main() {
    if (uDash > 0.0 && fract(vAlong / uDash) > 0.55) {
      discard;
    }
    float through = abs(dot(normalize(vFacing), normalize(vToEye)));
    float depth = pow(through, uSoft);
    vec3 drift = vec3(uTime * 0.021, uTime * 0.013, -uTime * 0.017);
    float thick = haze(vPlace * 9.0 + drift * 4.0);
    float mote = pow(haze(vPlace * 70.0 + drift * 30.0), 9.0);
    float glow = uStrength * depth * (0.72 + 0.5 * thick + 2.4 * mote);
    vec3 light = mix(uColor, vec3(1.0), uHot * depth * depth);
    gl_FragColor = vec4(light, glow);
    #include <colorspace_fragment>
  }
`;

/** One body of a beam: its bright core, or the wider halo of light scattered around it. */
function beamBody(color: string, soft: number, hot: number) {
  const uniforms = {
    uColor: { value: new Color(color) },
    uDash: { value: 0 },
    uHot: { value: hot },
    uSoft: { value: soft },
    uStrength: { value: 1 },
    uTime: { value: 0 },
  };
  return {
    material: new ShaderMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      fragmentShader: FRAGMENT,
      side: DoubleSide,
      toneMapped: false,
      transparent: true,
      uniforms,
      vertexShader: VERTEX,
    }),
    uniforms,
  };
}

/** Lays one body of a beam along its path: one stretched round part from each point to the next, `wide` in radius. */
function layBody(
  body: InstancedMesh | null,
  points: readonly Point[],
  wide: number
) {
  if (body === null) {
    return;
  }
  for (let index = 0; index < body.count; index += 1) {
    const start = points[index] ?? [0, 0, 0];
    const end = points[index + 1] ?? start;
    from.set(start[0], start[1], start[2]);
    span.set(end[0], end[1], end[2]).sub(from);
    const long = span.length();
    part.position.copy(from).addScaledVector(span, 0.5);
    part.quaternion.setFromUnitVectors(
      UP,
      long > 0 ? span.divideScalar(long) : UP
    );
    part.scale.set(wide, long, wide);
    part.updateMatrix();
    body.setMatrixAt(index, part.matrix);
  }
  body.instanceMatrix.needsUpdate = true;
}

/**
 * A ray of light made visible, as a narrow beam is in slightly dusty air: a
 * bright core inside a halo of scattered light, running through `points` in
 * turn, so a path that bends at a lens or a glass face is one beam. The
 * points are the lab's own traced path, so the beam is exactly where the
 * law that bent it says. A `dashed` beam is the line a ray only seems to
 * come along, which leads back to a virtual image.
 *
 * The beam owns its bodies and frees them with itself. Its dust drifts on
 * the stage's clock and allocates nothing while it does.
 *
 * @param color - The colour of the light
 * @param points - The path, in scene units, of at least two points
 * @param strength - How bright the beam is, from 0 to 1
 * @param width - The radius of the bright core
 * @param dashed - Whether this is the extension of a ray rather than light
 */
export function Beam({
  color,
  dashed = false,
  points,
  strength = 1,
  width = 0.012,
}: {
  readonly color: string;
  readonly dashed?: boolean;
  readonly points: readonly Point[];
  readonly strength?: number;
  readonly width?: number;
}) {
  const core = useRef<InstancedMesh>(null);
  const halo = useRef<InstancedMesh>(null);
  const count = Math.max(points.length - 1, 1);
  const bodies = useMemo(
    () => ({
      core: beamBody(color, 1.6, 0.85),
      halo: beamBody(color, 2.6, 0),
    }),
    [color]
  );

  useLayoutEffect(
    () => () => {
      bodies.core.material.dispose();
      bodies.halo.material.dispose();
    },
    [bodies]
  );

  useLayoutEffect(() => {
    bodies.core.uniforms.uStrength.value = dashed ? strength * 0.5 : strength;
    bodies.halo.uniforms.uStrength.value = dashed ? 0 : strength * 0.3;
    bodies.core.uniforms.uDash.value = dashed ? width * 9 : 0;
    layBody(core.current, points, dashed ? width * 0.6 : width);
    layBody(halo.current, points, width * HALO);
  }, [bodies, dashed, points, strength, width]);

  useFrame((state) => {
    bodies.core.uniforms.uTime.value = state.clock.elapsedTime;
    bodies.halo.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, count]}
        frustumCulled={false}
        key={`core-${count}`}
        material={bodies.core.material}
        ref={core}
        renderOrder={8}
      >
        <cylinderGeometry args={[1, 1, 1, SIDES, 1, true]} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, count]}
        frustumCulled={false}
        key={`halo-${count}`}
        material={bodies.halo.material}
        ref={halo}
        renderOrder={7}
      >
        <cylinderGeometry args={[1, 1, 1, SIDES, 1, true]} />
      </instancedMesh>
    </group>
  );
}

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vAcross;

  void main() {
    vAcross = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vAcross;

  void main() {
    float away = length(vAcross);
    float spot = exp(-away * away * 22.0);
    float spill = exp(-away * away * 3.2) * 0.34;
    float glow = uStrength * (spot + spill) * smoothstep(1.0, 0.7, away);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), spot * 0.8), glow);
    #include <colorspace_fragment>
  }
`;

/**
 * The soft pool of light where a beam lands on a screen, a card or a
 * benchtop: a hot spot the width of the beam inside the wider spill that a
 * matt surface scatters. It lies flat in its own plane, facing +z, so the
 * part it lands on turns it.
 *
 * @param color - The colour of the light
 * @param size - How wide the whole pool is
 * @param strength - How bright the spot is, from 0 to 1
 */
export function Glow({
  color,
  size,
  strength = 1,
}: {
  readonly color: string;
  readonly size: number;
  readonly strength?: number;
}) {
  const pool = useMemo(() => {
    const uniforms = {
      uColor: { value: new Color(color) },
      uStrength: { value: 1 },
    };
    return {
      material: new ShaderMaterial({
        blending: AdditiveBlending,
        depthWrite: false,
        fragmentShader: GLOW_FRAGMENT,
        side: DoubleSide,
        toneMapped: false,
        transparent: true,
        uniforms,
        vertexShader: GLOW_VERTEX,
      }),
      uniforms,
    };
  }, [color]);

  useLayoutEffect(() => () => pool.material.dispose(), [pool]);
  useLayoutEffect(() => {
    pool.uniforms.uStrength.value = strength;
  }, [pool, strength]);

  return (
    <mesh material={pool.material} renderOrder={9}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}
