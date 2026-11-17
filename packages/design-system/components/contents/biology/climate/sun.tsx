import { Billboard } from "@react-three/drei";
import {
  useClock,
  useFlowMaterial,
  useTubes,
} from "@repo/design-system/components/contents/biology/climate/flow";
import {
  SUN,
  sunBeams,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, Color, ShaderMaterial } from "three";

/** How far the corona reaches from the Sun's centre, in its radii. */
const CORONA_REACH = 4.2;

/**
 * The Sun's disc, white at its centre and redder toward its edge, where the
 * line of sight crosses cooler, higher gas: the limb darkening of visible
 * sunlight, I(mu) = 1 - 0.6 (1 - mu). Brighter than white, so it blooms.
 */
const DISC_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const DISC_FRAGMENT = /* glsl */ `
uniform vec3 core;
uniform vec3 limb;
varying vec3 vNormal;
varying vec3 vView;

void main() {
  float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  float darkening = 1.0 - 0.6 * (1.0 - mu);
  vec3 color = mix(limb, core, pow(mu, 0.6)) * darkening * 3.0;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The corona around the disc: a glow that falls off steeply from the limb,
 * with a faint wide halo and slow streamers that turn about the Sun.
 */
const CORONA_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORONA_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform vec3 core;
uniform float reach;
uniform float time;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float radii = r * reach;
  float outside = max(radii - 1.0, 0.0);
  float glow = 2.4 * exp(-outside * 2.6) + 0.32 * exp(-outside * 0.8);
  // Over the disc the glow gathers toward the limb, which softens its edge.
  glow *= mix(pow(min(radii, 1.0), 6.0), 1.0, step(1.0, radii));
  // Just off the limb the glow is as white as the disc, then turns golden.
  vec3 tint = mix(color, core, exp(-outside * 5.0));
  float wave = 0.5 + 0.5 * sin(a * 6.0 + 2.0 * sin(a * 2.0 + time * 0.08) + time * 0.03);
  float streamers = mix(1.0, 0.55 + 0.9 * pow(wave, 3.0), smoothstep(1.05, 1.9, radii));
  float edge = 1.0 - smoothstep(0.72, 1.0, r);
  gl_FragColor = vec4(tint * glow * streamers * edge, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The Sun: a glowing, limb-darkened disc with its corona, and the bright
 * straight sunbeams that cross to the Earth and strike its surface.
 */
export function Sun() {
  const disc = useMemo(
    () =>
      new ShaderMaterial({
        fragmentShader: DISC_FRAGMENT,
        uniforms: {
          core: { value: new Color(ECOLOGY_COLORS.sunCore) },
          limb: { value: new Color(ECOLOGY_COLORS.sunLimb) },
        },
        vertexShader: DISC_VERTEX,
      }),
    []
  );
  useEffect(() => () => disc.dispose(), [disc]);

  return (
    <group>
      <mesh material={disc} position={SUN.position}>
        <sphereGeometry args={[SUN.radius, 48, 32]} />
      </mesh>
      <Corona />
      <Beams />
    </group>
  );
}

/** The corona, which faces the camera wherever it orbits. */
function Corona() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        fragmentShader: CORONA_FRAGMENT,
        transparent: true,
        uniforms: {
          color: { value: new Color(ECOLOGY_COLORS.sunCorona) },
          core: { value: new Color(ECOLOGY_COLORS.sunCore) },
          reach: { value: CORONA_REACH },
          time: { value: 0 },
        },
        vertexShader: CORONA_VERTEX,
      }),
    []
  );
  useClock(material);

  return (
    <CameraBounds exclude>
      <Billboard position={SUN.position}>
        <mesh material={material}>
          <planeGeometry
            args={[
              SUN.radius * CORONA_REACH * 2,
              SUN.radius * CORONA_REACH * 2,
            ]}
          />
        </mesh>
      </Billboard>
    </CameraBounds>
  );
}

/** The sunbeams, with pulses of light running down them to the ground. */
function Beams() {
  const paths = useMemo(
    () =>
      Arr.map(sunBeams(), (beam) => ({
        fades: false,
        length: beam.length,
        offset: 0,
        points: [beam.start, beam.end],
      })),
    []
  );
  const core = useTubes(paths, 0.014);
  const haze = useTubes(paths, 0.042);
  const bright = useFlowMaterial(ECOLOGY_COLORS.sunlight, 2.6, 0.34, 0.9);
  const soft = useFlowMaterial(ECOLOGY_COLORS.sunlight, 0.32, 0.34, 0.9);

  return (
    <group>
      <mesh geometry={haze} material={soft} />
      <mesh geometry={core} material={bright} />
    </group>
  );
}
