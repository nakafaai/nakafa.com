import type { Ref } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { AdditiveBlending, Color, ShaderMaterial } from "three";

/**
 * How a mote's halo is drawn: bright where the eye looks through the middle
 * of the ball and fading to nothing at its outline, added to what is behind
 * it, so it reads as light and has no edge.
 */
const HALO = {
  fragment: `
uniform vec3 glow;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = max( dot( normalize( vNormal ), normalize( vView ) ), 0.0 );
  gl_FragColor = vec4( glow, pow( facing, 2.4 ) * 0.85 );
}`,
  vertex: `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 place = modelViewMatrix * vec4( position, 1.0 );
  vNormal = normalMatrix * normal;
  vView = -place.xyz;
  gl_Position = projectionMatrix * place;
}`,
} as const;

/** The halo of one colour: light added over the scene, never hiding it. */
function createHalo(color: string) {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    fragmentShader: HALO.fragment,
    transparent: true,
    uniforms: { glow: { value: new Color(color) } },
    vertexShader: HALO.vertex,
  });
}

/**
 * A particle a lesson shows moving through apparatus, an electron on a lead
 * or an ion in a solution, drawn as what it is at that scale: a point of
 * its own light with a soft halo that fades to nothing, in the colour the
 * lesson's legend gives it. `core` is how much of it is the bright point,
 * from 0 to 1: small for an electron, larger for an ion. A rig that moves
 * it every frame holds it by `ref`.
 *
 * @param color - The colour of its light
 * @param core - How much of its radius the bright point fills
 * @param position - Where it starts
 * @param radius - The reach of its halo, in scene units
 * @param ref - The mote itself, for a rig that moves it
 */
export function Mote({
  color,
  core = 0.4,
  position,
  radius,
  ref,
}: {
  readonly color: string;
  readonly core?: number;
  readonly position?: readonly [number, number, number];
  readonly radius: number;
  readonly ref?: Ref<Group>;
}) {
  const halo = useMemo(() => createHalo(color), [color]);
  useEffect(() => () => halo.dispose(), [halo]);

  return (
    <group
      {...(position === undefined ? {} : { position })}
      {...(ref === undefined ? {} : { ref })}
    >
      <mesh>
        <sphereGeometry args={[radius * core, 20, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.6}
          roughness={0.3}
        />
      </mesh>
      <mesh material={halo} renderOrder={4}>
        <sphereGeometry args={[radius, 24, 16]} />
      </mesh>
    </group>
  );
}
