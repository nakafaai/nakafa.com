import { useDocumentVisibility, useReducedMotion } from "@mantine/hooks";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useStableMutableValue } from "@repo/design-system/hooks/stable";
import { createFramePace } from "@repo/design-system/lib/pace";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DepthTexture,
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { Water } from "@/components/island/water";
import { paletteIndex } from "@/lib/island/palette";
import { paletteTexture } from "@/lib/island/texture";

/** The ambient life's frame rate at most, a frame every 33 milliseconds. */
const FRAME_GAP = 1000 / 30;

const SCREEN_VERTEX = /* glsl */ `
precision highp float;
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * The outline and sky pass. A pixel whose neighbour lies much farther away is
 * on a silhouette: against the sky it takes the darkest ink, against another
 * surface the darkest tone of its own ramp, which reads as a hand-drawn line.
 * Sprites carry their own outlines and are left alone. Empty pixels are sky,
 * drawn in flat bands that lighten toward the horizon.
 */
const OUTLINE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D colorTarget;
uniform sampler2D normalTarget;
uniform sampler2D depthTarget;
uniform sampler2D palette;
uniform vec2 resolution;
uniform int ink;
uniform int sky;
out vec4 outColor;
float depthAt(ivec2 p) {
  return texelFetch(depthTarget, clamp(p, ivec2(0), ivec2(resolution) - 1), 0).r;
}
vec3 colorOf(int index) { return texelFetch(palette, ivec2(index, 0), 0).rgb; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float d = depthAt(p);
  if (d >= 0.99999) {
    float y = gl_FragCoord.y / resolution.y;
    int band = y > 0.78 ? 0 : (y > 0.56 ? 1 : (y > 0.32 ? 2 : 3));
    outColor = vec4(colorOf(sky + band), 1.0);
    return;
  }
  vec4 c = texelFetch(colorTarget, p, 0);
  if (texelFetch(normalTarget, p, 0).a < 0.5) {
    outColor = vec4(c.rgb, 1.0);
    return;
  }
  float far = max(
    max(depthAt(p + ivec2(1, 0)), depthAt(p - ivec2(1, 0))),
    max(depthAt(p + ivec2(0, 1)), depthAt(p - ivec2(0, 1)))
  );
  int index = int(c.a * 255.0 + 0.5);
  if (far >= 0.99999) {
    outColor = vec4(colorOf(ink), 1.0);
  } else if (far - d > 0.004) {
    outColor = vec4(colorOf(index - index % 4), 1.0);
  } else {
    outColor = vec4(c.rgb, 1.0);
  }
}
`;

const COPY_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D source;
out vec4 outColor;
void main() { outColor = texelFetch(source, ivec2(gl_FragCoord.xy), 0); }
`;

/**
 * A screen pass: one triangle over the whole screen, never culled, since its
 * shader ignores the camera, and drawn before anything else in its scene.
 */
function screenPass(geometry: BufferGeometry, material: RawShaderMaterial) {
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return new Scene().add(mesh);
}

/** One triangle that covers the whole screen. */
function screenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );
  return geometry;
}

/** The targets, scenes and materials of the three passes, for one buffer size. */
function usePasses(columns: number, rows: number) {
  return useMemo(() => {
    const depth = new DepthTexture(columns, rows);
    const scene = new WebGLRenderTarget(columns, rows, {
      count: 2,
      depthTexture: depth,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
    });
    const outlined = new WebGLRenderTarget(columns, rows, {
      depthBuffer: false,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
    });
    const triangle = screenTriangle();
    const outline = screenPass(
      triangle,
      new RawShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: OUTLINE_FRAGMENT,
        glslVersion: GLSL3,
        uniforms: {
          colorTarget: { value: scene.textures[0] },
          depthTarget: { value: depth },
          normalTarget: { value: scene.textures[1] },
          ink: { value: paletteIndex("ink", 0) },
          palette: { value: paletteTexture() },
          resolution: { value: new Vector2(columns, rows) },
          sky: { value: paletteIndex("sky", 0) },
        },
        vertexShader: SCREEN_VERTEX,
      })
    );
    const copy = screenPass(
      triangle,
      new RawShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: COPY_FRAGMENT,
        glslVersion: GLSL3,
        uniforms: { source: { value: outlined.texture } },
        vertexShader: SCREEN_VERTEX,
      })
    );
    return {
      flat: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
      outline,
      outlined,
      scene,
      screen: copy,
    };
  }, [columns, rows]);
}

/**
 * Keeps the water and the animals moving: after each frame it asks for the
 * next one at 30 frames a second at most, kept to its share of the main thread
 * by `createFramePace`. It stops while the page is hidden and starts again when
 * the page shows, and with reduced motion the island draws once and holds its
 * pose (ADR 0042, D17). Returns what the frame calls once it is drawn.
 */
function useAmbientLoop() {
  const invalidate = useThree((state) => state.invalidate);
  const calm = useReducedMotion();
  const visibility = useDocumentVisibility();
  const pace = useStableMutableValue(createFramePace);
  const timer = useRef(0);
  useEffect(() => {
    if (!calm && visibility === "visible") {
      invalidate();
    }
    return () => window.clearTimeout(timer.current);
  }, [calm, invalidate, visibility]);
  return (startedAt: number) => {
    pace.rest(startedAt, performance.now());
    window.clearTimeout(timer.current);
    if (calm || visibility !== "visible") {
      return;
    }
    const wait = () => {
      timer.current = window.setTimeout(() => {
        if (pace.isDue(performance.now())) {
          invalidate();
          return;
        }
        wait();
      }, FRAME_GAP);
    };
    wait();
  };
}

/**
 * Draws the island in three passes at the art resolution (ADR 0042, D15): the
 * scene into a colour and normal target with its depth, the outline and sky pass
 * into a second target, and that target to the screen with the water drawn over
 * it. Each pass clears its target first, as the renderer does by default. The
 * browser enlarges the canvas with nearest-neighbour sampling.
 */
export function PixelPipeline({
  angle,
  children,
  columns,
  rows,
  size,
}: {
  angle: number;
  children: ReactNode;
  columns: number;
  rows: number;
  size: number;
}) {
  const passes = usePasses(columns, rows);
  const afterFrame = useAmbientLoop();
  useEffect(
    () => () => {
      passes.scene.dispose();
      passes.outlined.dispose();
    },
    [passes]
  );
  useFrame((state) => {
    const startedAt = performance.now();
    const renderer = state.gl;
    renderer.setRenderTarget(passes.scene);
    renderer.render(state.scene, state.camera);
    renderer.setRenderTarget(passes.outlined);
    renderer.render(passes.outline, passes.flat);
    renderer.setRenderTarget(null);
    renderer.render(passes.screen, state.camera);
    // The browser specs wait on this mark, which the first finished frame sets.
    renderer.domElement.toggleAttribute("data-drawn", true);
    afterFrame(startedAt);
  }, 1);
  return (
    <>
      {children}
      {createPortal(
        <group position={[size / 2, 0, size / 2]} rotation={[0, angle, 0]}>
          <group position={[-size / 2, 0, -size / 2]}>
            <Water outlined={passes.outlined} scene={passes.scene} />
          </group>
        </group>,
        passes.screen
      )}
    </>
  );
}
