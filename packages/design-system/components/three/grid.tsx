import { useFrame, useThree } from "@react-three/fiber";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { gridSteps } from "@repo/design-system/lib/geometry/step";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import type { Camera, ColorRepresentation } from "three";
import {
  Color,
  DoubleSide,
  OrthographicCamera,
  PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";

/**
 * Places each vertex of a grid plane and hands the fragment its value in
 * mathematical units: the plane's local position less the origin's, divided
 * by the world units each mathematical unit takes on that axis.
 */
const VERTEX = /* glsl */ `
  uniform vec2 origin;
  uniform vec2 scale;
  varying vec2 value;
  varying vec3 world;

  void main() {
    value = (position.xy - origin) / scale;
    vec4 placed = modelMatrix * vec4(position, 1.0);
    world = placed.xyz;
    gl_Position = projectionMatrix * viewMatrix * placed;
  }
`;

/**
 * Draws minor and major lines at whole multiples of their steps on each axis,
 * one pixel wide at any zoom (`fwidth`), the way drei's Grid does, but with a
 * step of its own on each axis, so a graph whose axes scale apart still gets
 * lines at nice values on both.
 */
const FRAGMENT = /* glsl */ `
  uniform vec2 cell;
  uniform vec2 section;
  uniform vec3 cellColor;
  uniform vec3 sectionColor;
  uniform float opacity;
  uniform vec3 fadeCenter;
  uniform float fadeDistance;
  varying vec2 value;
  varying vec3 world;

  float lines(vec2 size, float thickness) {
    vec2 r = value / size;
    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
    float line = min(grid.x, grid.y) + 1.0 - thickness;
    return 1.0 - min(line, 1.0);
  }

  void main() {
    float minor = lines(cell, 0.35);
    float major = lines(section, 0.6);
    float near = 1.0 - min(distance(world, fadeCenter) / fadeDistance, 1.0);
    vec3 color = mix(cellColor, sectionColor, min(1.0, 0.6 * major));
    float alpha = (minor + major) * near * near;
    alpha = mix(0.75 * alpha, alpha, major) * opacity;
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A perspective grid fades out this many world units from the camera's target, as drei's Grid did. */
const PERSPECTIVE_FADE = 80;

/** An orthographic grid does not fade: the whole reach stays as clear as the first view. */
const NO_FADE = 1e9;

/**
 * The three grid planes, each through the origin: which world axes its local
 * x and y run along, and how it turns from the XY plane to lie there.
 */
const PLANES = [
  { axes: ["x", "y"], id: "xy", normal: "z", rotation: [0, 0, 0] },
  { axes: ["x", "z"], id: "xz", normal: "y", rotation: [Math.PI / 2, 0, 0] },
  { axes: ["z", "y"], id: "yz", normal: "x", rotation: [0, -Math.PI / 2, 0] },
] as const;

/**
 * The shorter side, in world units, of what the camera shows around its
 * target: an orthographic camera's view divided by its zoom, or the height a
 * perspective camera's field of view spans at the target's distance.
 */
function visibleSpan(camera: Camera, target: Vector3) {
  if (camera instanceof OrthographicCamera) {
    return (
      Math.min(camera.right - camera.left, camera.top - camera.bottom) /
      camera.zoom
    );
  }
  if (camera instanceof PerspectiveCamera) {
    const height =
      2 *
      camera.position.distanceTo(target) *
      Math.tan((camera.fov * Math.PI) / 360);
    return Math.min(height, height * camera.aspect);
  }
  return Number.NaN;
}

/** A grid plane's material: its lines, colors and fade, set each frame. */
function createGridMaterial() {
  return new ShaderMaterial({
    depthWrite: false,
    fragmentShader: FRAGMENT,
    side: DoubleSide,
    transparent: true,
    uniforms: {
      cell: { value: new Vector2(1, 1) },
      cellColor: { value: new Color() },
      fadeCenter: { value: new Vector3() },
      fadeDistance: { value: NO_FADE },
      opacity: { value: 1 },
      origin: { value: new Vector2() },
      scale: { value: new Vector2(1, 1) },
      section: { value: new Vector2(5, 5) },
      sectionColor: { value: new Color() },
    },
    vertexShader: VERTEX,
  });
}

/**
 * The grid of an unbounded world: three planes through the origin, with
 * lines at nice values in mathematical units on each axis (`gridSteps`),
 * re-stepped as the camera zooms, and covering the whole reach. `scale` is the
 * world units one mathematical unit takes on each axis, so a graph whose axes
 * scale apart keeps lines at nice values on both.
 */
export function CoordinateGrid({
  cellColor,
  origin = { x: 0, y: 0, z: 0 },
  reach,
  scale = { x: 1, y: 1, z: 1 },
  sectionColor,
}: {
  readonly cellColor: ColorRepresentation;
  readonly origin?: Point3 | undefined;
  /** Half-width, in world units, of the box around the world's center that the camera can show. */
  readonly reach: number;
  readonly scale?: Point3 | undefined;
  readonly sectionColor: ColorRepresentation;
}) {
  const controls = useThree((state) => state.controls);
  // A perspective camera sees a plane out to its fade; an orthographic one only within the reach.
  const half = Math.max(reach, PERSPECTIVE_FADE) * 2;
  const materials = useMemo(
    () => Arr.map(PLANES, () => createGridMaterial()),
    []
  );
  const fallback = useMemo(
    () => new Vector3(origin.x, origin.y, origin.z),
    [origin]
  );

  useEffect(
    () => () => {
      for (const material of materials) {
        material.dispose();
      }
    },
    [materials]
  );

  // Each plane stands at the world's center within itself, so its mesh stays
  // small wherever the origin lies, and its shader reads values from the origin.
  useEffect(() => {
    Arr.forEach(PLANES, ({ axes: [first, second] }, index) => {
      const uniforms = materials[index]?.uniforms;
      uniforms?.cellColor?.value.set(cellColor);
      uniforms?.sectionColor?.value.set(sectionColor);
      uniforms?.origin?.value.set(origin[first], origin[second]);
      uniforms?.scale?.value.set(scale[first], scale[second]);
    });
  }, [cellColor, materials, origin, scale, sectionColor]);

  // Camera presentation: rewrite the steps only when the zoom changes them.
  useFrame(({ camera }) => {
    const target =
      controls && "target" in controls && controls.target instanceof Vector3
        ? controls.target
        : fallback;
    const span = visibleSpan(camera, target);
    const perspective = !(camera instanceof OrthographicCamera);
    Arr.forEach(PLANES, ({ axes: [first, second], id }, index) => {
      const uniforms = materials[index]?.uniforms;
      if (!uniforms) {
        return;
      }
      const one = gridSteps(span / scale[first]);
      const two = gridSteps(span / scale[second]);
      uniforms.cell?.value.set(one.minor, two.minor);
      uniforms.section?.value.set(one.major, two.major);
      if (uniforms.fadeDistance) {
        uniforms.fadeDistance.value = perspective ? PERSPECTIVE_FADE : NO_FADE;
      }
      uniforms.fadeCenter?.value.copy(target);
      // A flat scene's side planes stand edge-on to its first view; once a
      // learner orbits, they show at half strength behind the plane that matters.
      if (uniforms.opacity) {
        uniforms.opacity.value = !perspective && id !== "xy" ? 0.5 : 1;
      }
    });
  });

  return (
    <group>
      {Arr.map(PLANES, (plane, index) => (
        <mesh
          frustumCulled={false}
          key={plane.id}
          material={materials[index]}
          position={[
            plane.normal === "x" ? origin.x : 0,
            plane.normal === "y" ? origin.y : 0,
            plane.normal === "z" ? origin.z : 0,
          ]}
          rotation={plane.rotation}
        >
          <planeGeometry args={[half * 2, half * 2]} />
        </mesh>
      ))}
    </group>
  );
}
