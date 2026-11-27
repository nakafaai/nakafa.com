import { Glow } from "@repo/design-system/components/three/optic/beam";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Path,
  ShaderMaterial,
  Shape,
  Vector2,
} from "three";

/** The side of the square slide a slit plate is, and how thick its metal is. */
const SLIDE = 0.5;
const SLIDE_THICK = 0.008;

/** How wide each slit is cut. */
const CUT = 0.007;

/** How far below the middle of its slide a slit plate's mount reaches, which a carrier's post takes. */
export const SLIDE_DROP = SLIDE / 2 + 0.07;

/** The outline of the slide with its slits cut through it. */
function slideOutline(gap: number, tall: number) {
  const outline = new Shape();
  const half = SLIDE / 2;
  const round = 0.02;
  outline.moveTo(-half + round, -half);
  outline.lineTo(half - round, -half);
  outline.quadraticCurveTo(half, -half, half, -half + round);
  outline.lineTo(half, half - round);
  outline.quadraticCurveTo(half, half, half - round, half);
  outline.lineTo(-half + round, half);
  outline.quadraticCurveTo(-half, half, -half, half - round);
  outline.lineTo(-half, -half + round);
  outline.quadraticCurveTo(-half, -half, -half + round, -half);
  for (const side of [-1, 1]) {
    const cut = new Path();
    const at = (side * gap) / 2;
    cut.moveTo(at - CUT / 2, -tall / 2);
    cut.lineTo(at - CUT / 2, tall / 2);
    cut.lineTo(at + CUT / 2, tall / 2);
    cut.lineTo(at + CUT / 2, -tall / 2);
    cut.closePath();
    outline.holes.push(cut);
  }
  return outline;
}

/** The turned outline of the knurled screw that clamps a slide in its holder. */
const SCREW_PROFILE = Arr.map(
  [
    [0.0004, 0],
    [0.008, 0],
    [0.008, 0.022],
    [0.02, 0.024],
    [0.022, 0.028],
    [0.022, 0.044],
    [0.019, 0.048],
    [0.0004, 0.048],
  ] as const,
  ([radius, along]) => new Vector2(radius, along)
);

/**
 * A double slit standing across the optical axis, which runs along x
 * through its middle: a blackened metal slide with two slits cut through
 * it, `gap` apart, in a slotted holder with a clamping screw. Light that
 * reaches it glows in the slits, in its `color`.
 *
 * @param color - The colour of the light that reaches the slits
 * @param gap - How far apart the middles of the two slits are
 */
export function Slits({
  color,
  gap,
}: {
  readonly color: string;
  readonly gap: number;
}) {
  const tall = SLIDE * 0.36;
  const outline = useMemo(() => slideOutline(gap, tall), [gap, tall]);

  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow position={[0, 0, -SLIDE_THICK / 2]}>
        <extrudeGeometry
          args={[
            outline,
            {
              bevelEnabled: true,
              bevelSegments: 1,
              bevelSize: 0.0015,
              bevelThickness: 0.0015,
              curveSegments: 6,
              depth: SLIDE_THICK - 0.003,
            },
          ]}
        />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.graphite}
          metalness={1}
          repeat={[2, 2]}
          roughness={0.7}
          surface="brushed"
        />
      </mesh>
      {Arr.map(
        [
          { at: [0, -SLIDE / 2 - 0.012, 0], key: "sill", size: [SLIDE + 0.07, 0.04, 0.04] },
          { at: [-SLIDE / 2 - 0.018, -0.02, 0], key: "left", size: [0.03, SLIDE, 0.04] },
          { at: [SLIDE / 2 + 0.018, -0.02, 0], key: "right", size: [0.03, SLIDE, 0.04] },
        ] as const,
        (bar) => (
          <mesh castShadow key={bar.key} position={bar.at}>
            <boxGeometry args={bar.size} />
            <SurfaceMaterial
              color={INSTRUMENT_COLORS.anodised}
              metalness={1}
              repeat={[1, 3]}
              roughness={0.4}
              surface="brushed"
            />
          </mesh>
        )
      )}
      <mesh
        castShadow
        position={[SLIDE / 2 + 0.03, SLIDE * 0.2, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <latheGeometry args={[SCREW_PROFILE, 32]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.aluminium}
          metalness={1}
          repeat={[6, 1]}
          roughness={0.28}
          surface="knurl"
        />
      </mesh>
      <mesh castShadow position={[0, -SLIDE / 2 - 0.05, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.05, 24]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.anodised}
          metalness={1}
          repeat={[2, 1]}
          roughness={0.38}
          surface="brushed"
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh key={side} position={[(side * gap) / 2, 0, 0]}>
          <planeGeometry args={[CUT, tall]} />
          <meshBasicMaterial
            color={color}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      <group position={[0, 0, -SLIDE_THICK]}>
        <Glow color={color} size={0.22} strength={0.7} />
      </group>
    </group>
  );
}

const FRINGE_VERTEX = /* glsl */ `
  varying vec2 vAcross;

  void main() {
    vAcross = uv - 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Two beams that overlap: the brightness across the band follows the square
 * of the cosine of half their phase difference, which runs through a whole
 * turn every fringe spacing, and the band fades at its top and bottom as the
 * light of a slit of finite height does.
 */
const FRINGE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uSpacing;
  uniform float uStart;
  varying vec2 vAcross;

  void main() {
    float wave = cos(3.14159265 * (vAcross.x - uStart) / uSpacing);
    float bright = wave * wave;
    float band = smoothstep(0.5, 0.3, abs(vAcross.y));
    float edge = smoothstep(0.5, 0.46, abs(vAcross.x));
    vec3 light = mix(uColor, vec3(1.0), bright * bright * 0.35);
    gl_FragColor = vec4(light, bright * band * edge * 0.96);
    #include <colorspace_fragment>
  }
`;

/**
 * The fringes two slits throw on a screen, as a band `wide` by `tall` in
 * the plane of its group, facing +z: bright where the light of the two
 * slits arrives in step and dark where it arrives half a wave apart.
 * `spacing` is the distance from one bright fringe to the next and `start`
 * the place of one bright fringe, both as shares of the band's width, with
 * `start` measured from its middle.
 *
 * @param color - The colour of the light
 * @param spacing - The fringe spacing, as a share of the band's width
 * @param start - Where one bright fringe stands, as a share of the band's width from its middle
 * @param tall - The height of the band
 * @param wide - The width of the band
 */
export function Fringes({
  color,
  spacing,
  start,
  tall,
  wide,
}: {
  readonly color: string;
  readonly spacing: number;
  readonly start: number;
  readonly tall: number;
  readonly wide: number;
}) {
  const band = useMemo(() => {
    const uniforms = {
      uColor: { value: new Color(color) },
      uSpacing: { value: 1 },
      uStart: { value: 0 },
    };
    return {
      material: new ShaderMaterial({
        depthWrite: false,
        fragmentShader: FRINGE_FRAGMENT,
        toneMapped: false,
        transparent: true,
        uniforms,
        vertexShader: FRINGE_VERTEX,
      }),
      uniforms,
    };
  }, [color]);

  useLayoutEffect(() => () => band.material.dispose(), [band]);
  useLayoutEffect(() => {
    band.uniforms.uSpacing.value = spacing;
    band.uniforms.uStart.value = start;
  }, [band, spacing, start]);

  return (
    <mesh material={band.material} renderOrder={5}>
      <planeGeometry args={[wide, tall]} />
    </mesh>
  );
}

/**
 * The light that spreads from a pair of slits to a screen, as faint haze in
 * the dusty air between them: a fan from the origin along +x that is `wide`
 * across where it lands, `long` away. It lies in the plane the slits spread
 * their light in, which is level for upright slits.
 *
 * @param color - The colour of the light
 * @param long - How far away the screen stands
 * @param wide - How wide the light is where it lands
 */
export function Spread({
  color,
  long,
  wide,
}: {
  readonly color: string;
  readonly long: number;
  readonly wide: number;
}) {
  const fan = useMemo(() => {
    const outline = new Shape();
    outline.moveTo(0, 0);
    outline.lineTo(long, -wide / 2);
    outline.lineTo(long, wide / 2);
    outline.closePath();
    return outline;
  }, [long, wide]);

  return (
    <mesh renderOrder={7} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[fan]} />
      <meshBasicMaterial
        blending={AdditiveBlending}
        color={color}
        depthWrite={false}
        opacity={0.16}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
