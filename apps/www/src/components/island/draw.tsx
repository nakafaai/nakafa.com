import { Option } from "effect";
import {
  ATLAS_SIZE,
  ATLAS_TILES,
  atlasPixels,
  SLOTS,
} from "@/lib/island/atlas";
import { eyeOf, type Orbit } from "@/lib/island/camera";
import { viewProjectionOf } from "@/lib/island/matrix";
import { type meshChunk, STRIDE } from "@/lib/island/mesh";
import type { Light } from "@/lib/island/sky";
import { CHUNKS, SEA_LEVEL, SPAN } from "@/lib/island/world";

/** The chunk program: atlas pixels lit by the sun, the sky over them and the lamps beside them, fading into fog. */
const CHUNK_VERTEX = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUv;
layout(location = 2) in float aShade;
layout(location = 3) in float aSky;
layout(location = 4) in float aGlow;
uniform mat4 uViewProjection;
uniform vec3 uEye;
out vec2 vUv;
out float vShade;
out float vSky;
out float vGlow;
out float vDistance;
out vec3 vWorld;
void main() {
  vUv = aUv;
  vShade = aShade;
  vSky = aSky;
  vGlow = aGlow;
  vWorld = aPosition;
  vDistance = distance(aPosition, uEye);
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}`;

const CHUNK_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uSun;
uniform vec3 uAmbient;
uniform vec3 uLamp;
uniform vec3 uFog;
uniform vec2 uFogRange;
uniform float uAlpha;
uniform float uTime;
uniform vec2 uWaterTile;
uniform float uWater;
in vec2 vUv;
in float vShade;
in float vSky;
in float vGlow;
in float vDistance;
in vec3 vWorld;
out vec4 color;
void main() {
  vec2 uv = vUv;
  if (uWater > 0.5) {
    vec2 local = fract(vWorld.xz * 0.5 + vec2(uTime * 0.04, uTime * 0.017) + vWorld.y * 0.5);
    uv = (uWaterTile + 0.002 + local * 0.996) / 8.0;
  }
  vec4 texel = texture(uAtlas, uv);
  if (texel.a < 0.5) discard;
  vec3 light = uAmbient * (0.55 + 0.45 * vShade) + uSun * vShade * vSky;
  light = max(light, uLamp * vGlow * vGlow * vShade);
  light = floor(light * 12.0 + 0.5) / 12.0;
  float fog = smoothstep(uFogRange.x, uFogRange.y, vDistance);
  color = vec4(mix(texel.rgb * light, uFog, fog), uAlpha);
}`;

/** The sky program: one triangle over the whole screen, from the zenith's color to the horizon's. */
const SKY_VERTEX = `#version 300 es
out float vHeight;
void main() {
  vec2 corner = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vHeight = corner.y * 0.5 + 0.5;
  gl_Position = vec4(corner, 1.0, 1.0);
}`;

const SKY_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uZenith;
uniform vec3 uHorizon;
in float vHeight;
out vec4 color;
void main() {
  float t = clamp(vHeight * 1.4 - 0.2, 0.0, 1.0);
  color = vec4(mix(uHorizon, uZenith, floor(t * 10.0) / 10.0), 1.0);
}`;

/**
 * A ring around the world, from its edge to the horizon, at height `y`: the
 * sea's surface, and under it the sea floor, so the open sea looks as deep as
 * the water inside the world. `uv` is the atlas point the floor takes its color from.
 */
function seaRing(y: number, uv: readonly [number, number]) {
  const far = 600;
  const quads = [
    [-far, -far, SPAN + far, 0],
    [-far, SPAN, SPAN + far, SPAN + far],
    [-far, 0, 0, SPAN],
    [SPAN, 0, SPAN + far, SPAN],
  ] as const;
  const vertices = new Float32Array(quads.length * 4 * STRIDE);
  const indices = new Uint32Array(quads.length * 6);
  for (const [index, [x0, z0, x1, z1]] of quads.entries()) {
    const corners = [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ] as const;
    for (const [corner, [x, z]] of corners.entries()) {
      vertices.set(
        [x, y, z, uv[0], uv[1], 1, 1, 0],
        (index * 4 + corner) * STRIDE
      );
    }
    indices.set(
      [0, 1, 2, 0, 2, 3].map((value) => value + index * 4),
      index * 6
    );
  }
  return { indices, vertices };
}

/**
 * Makes a program the one the next draws use. WebGL names this `useProgram`,
 * which the hook rule would read as a React hook, so it is called through
 * `Reflect.apply`.
 */
function activate(gl: WebGL2RenderingContext, program: WebGLProgram) {
  Reflect.apply(gl.useProgram, gl, [program]);
}

/** Compiles one program from its two shaders; none when the driver refuses them. */
function programOf(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string
) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (shader === null) {
      return Option.none();
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) === true
    ? Option.some(program)
    : Option.none();
}

/** Uploads one draw list to the GPU, its vertices laid out as the chunk program reads them. */
function uploadList(
  gl: WebGL2RenderingContext,
  list: { readonly vertices: Float32Array; readonly indices: Uint32Array }
) {
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, list.vertices, gl.STATIC_DRAW);
  const bytes = STRIDE * 4;
  for (const [location, size, offset] of [
    [0, 3, 0],
    [1, 2, 3],
    [2, 1, 5],
    [3, 1, 6],
    [4, 1, 7],
  ] as const) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, bytes, offset * 4);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, list.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return {
    count: list.indices.length,
    release: () => {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(indexBuffer);
    },
    vao,
  };
}

/** The art pixel for a screen: a whole number of device pixels, so its short side spans about 270 art pixels. */
export function artPixelOf(width: number, height: number) {
  return Math.max(1, Math.round(Math.min(width, height) / 270));
}

/**
 * The island's WebGL2 painter (ADR 0047, D2): it holds every chunk's buffers,
 * draws the sky, the solid pass and the water pass into a small framebuffer,
 * and enlarges it to the screen with nearest sampling. None when the browser
 * has no WebGL2.
 */
export function createPainter(canvas: HTMLCanvasElement) {
  const found = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  if (found === null) {
    return Option.none();
  }
  const gl = found;
  return Option.flatMap(
    Option.all([
      programOf(gl, CHUNK_VERTEX, CHUNK_FRAGMENT),
      programOf(gl, SKY_VERTEX, SKY_FRAGMENT),
    ]),
    ([chunkProgram, skyProgram]) => {
      const atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        ATLAS_SIZE,
        ATLAS_SIZE,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlasPixels()
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const target = {
        color: gl.createTexture(),
        depth: gl.createRenderbuffer(),
        frame: gl.createFramebuffer(),
        height: 1,
        width: 1,
      };
      const chunks = Array.from({ length: CHUNKS * CHUNKS }, () => ({
        solid: Option.none<ReturnType<typeof uploadList>>(),
        water: Option.none<ReturnType<typeof uploadList>>(),
      }));
      const sea = uploadList(gl, seaRing(SEA_LEVEL - 0.125, [0, 0]));
      const sandSlot = SLOTS.sand;
      const floor = uploadList(
        gl,
        seaRing(SEA_LEVEL - 5, [
          ((sandSlot % ATLAS_TILES) + 0.5) / ATLAS_TILES,
          (Math.floor(sandSlot / ATLAS_TILES) + 0.5) / ATLAS_TILES,
        ])
      );
      const uniform = (name: string) =>
        gl.getUniformLocation(chunkProgram, name);
      const skyUniform = (name: string) =>
        gl.getUniformLocation(skyProgram, name);
      const waterSlot = SLOTS.water;
      const waterTile = [
        waterSlot % ATLAS_TILES,
        Math.floor(waterSlot / ATLAS_TILES),
      ] as const;

      /** Sizes the small framebuffer to the canvas, in whole art pixels. */
      const resize = () => {
        const pixel = artPixelOf(canvas.width, canvas.height);
        const width = Math.max(1, Math.floor(canvas.width / pixel));
        const height = Math.max(1, Math.floor(canvas.height / pixel));
        if (width === target.width && height === target.height) {
          return;
        }
        target.width = width;
        target.height = height;
        gl.bindTexture(gl.TEXTURE_2D, target.color);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
        );
        gl.bindRenderbuffer(gl.RENDERBUFFER, target.depth);
        gl.renderbufferStorage(
          gl.RENDERBUFFER,
          gl.DEPTH_COMPONENT24,
          width,
          height
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          target.color,
          0
        );
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER,
          target.depth
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      };

      return Option.some({
        /** Replaces one chunk's buffers with its new mesh. */
        upload(index: number, mesh: ReturnType<typeof meshChunk>) {
          const slot = chunks[index];
          Option.map(slot.solid, (list) => list.release());
          Option.map(slot.water, (list) => list.release());
          slot.solid =
            mesh.solid.indices.length > 0
              ? Option.some(uploadList(gl, mesh.solid))
              : Option.none();
          slot.water =
            mesh.water.indices.length > 0
              ? Option.some(uploadList(gl, mesh.water))
              : Option.none();
        },
        /** Draws one frame: the sky, every chunk, then the water, enlarged to the canvas. */
        draw(orbit: Orbit, light: Light, time: number) {
          resize();
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame);
          gl.viewport(0, 0, target.width, target.height);
          gl.disable(gl.DEPTH_TEST);
          gl.disable(gl.BLEND);
          activate(gl, skyProgram);
          gl.uniform3fv(skyUniform("uZenith"), light.zenith);
          gl.uniform3fv(skyUniform("uHorizon"), light.horizon);
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          gl.enable(gl.DEPTH_TEST);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          gl.enable(gl.CULL_FACE);
          activate(gl, chunkProgram);
          gl.uniformMatrix4fv(
            uniform("uViewProjection"),
            false,
            viewProjectionOf(orbit, target.width / target.height)
          );
          gl.uniform3fv(uniform("uEye"), eyeOf(orbit));
          gl.uniform3fv(uniform("uSun"), light.sun);
          gl.uniform3fv(uniform("uAmbient"), light.ambient);
          gl.uniform3fv(uniform("uLamp"), light.lamp);
          gl.uniform3fv(uniform("uFog"), light.fog);
          gl.uniform2f(
            uniform("uFogRange"),
            orbit.distance + 30,
            orbit.distance + 160
          );
          gl.uniform1f(uniform("uTime"), time);
          gl.uniform2f(uniform("uWaterTile"), waterTile[0], waterTile[1]);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, atlas);
          gl.uniform1i(uniform("uAtlas"), 0);
          gl.uniform1f(uniform("uWater"), 0);
          gl.uniform1f(uniform("uAlpha"), 1);
          gl.bindVertexArray(floor.vao);
          gl.drawElements(gl.TRIANGLES, floor.count, gl.UNSIGNED_INT, 0);
          for (const chunk of chunks) {
            Option.map(chunk.solid, (list) => {
              gl.bindVertexArray(list.vao);
              gl.drawElements(gl.TRIANGLES, list.count, gl.UNSIGNED_INT, 0);
            });
          }

          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
          gl.disable(gl.CULL_FACE);
          gl.uniform1f(uniform("uWater"), 1);
          gl.uniform1f(uniform("uAlpha"), 0.8);
          for (const chunk of chunks) {
            Option.map(chunk.water, (list) => {
              gl.bindVertexArray(list.vao);
              gl.drawElements(gl.TRIANGLES, list.count, gl.UNSIGNED_INT, 0);
            });
          }
          gl.bindVertexArray(sea.vao);
          gl.drawElements(gl.TRIANGLES, sea.count, gl.UNSIGNED_INT, 0);
          gl.depthMask(true);
          gl.bindVertexArray(null);

          const scale = Math.max(
            1,
            Math.floor(
              Math.min(
                canvas.width / target.width,
                canvas.height / target.height
              )
            )
          );
          const left = Math.floor((canvas.width - target.width * scale) / 2);
          const top = Math.floor((canvas.height - target.height * scale) / 2);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.frame);
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
          gl.clearColor(
            light.horizon[0],
            light.horizon[1],
            light.horizon[2],
            1
          );
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.blitFramebuffer(
            0,
            0,
            target.width,
            target.height,
            left,
            top,
            left + target.width * scale,
            top + target.height * scale,
            gl.COLOR_BUFFER_BIT,
            gl.NEAREST
          );
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        },
        /** Lets the GPU go of everything the painter held. */
        release() {
          for (const chunk of chunks) {
            Option.map(chunk.solid, (list) => list.release());
            Option.map(chunk.water, (list) => list.release());
          }
          sea.release();
          floor.release();
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
      });
    }
  );
}

/** What the game holds of its painter. */
export type Painter = Option.Option.Value<ReturnType<typeof createPainter>>;
