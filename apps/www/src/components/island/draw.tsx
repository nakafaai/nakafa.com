import { Array as Arr, Option } from "effect";
import { createBodies } from "@/components/island/bodies";
import {
  activate,
  PARTICLES,
  programOf,
  seaRing,
  uploadList,
  uploadMoving,
  uploadOutline,
  uploadWeather,
} from "@/components/island/buffers";
import { createFrame } from "@/components/island/frame";
import {
  ATLAS_SIZE,
  ATLAS_TILES,
  atlasPixels,
  SLOTS,
} from "@/lib/island/atlas";
import { eyeOf, type Orbit, snapOrbit } from "@/lib/island/camera";
import { CLIP, invert, viewProjectionOf } from "@/lib/island/matrix";
import type { meshChunk } from "@/lib/island/mesh";
import { mipsOf } from "@/lib/island/mips";
import { repaintFor, type Season } from "@/lib/island/season";
import {
  BODY_FRAGMENT,
  BODY_VERTEX,
  CHUNK_FRAGMENT,
  CHUNK_VERTEX,
  EDGE_FRAGMENT,
  EDGE_VERTEX,
  OUTLINE_FRAGMENT,
  OUTLINE_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
  WEATHER_FRAGMENT,
  WEATHER_VERTEX,
} from "@/lib/island/shaders";
import { type Fall, fallOf, type Light, type Weather } from "@/lib/island/sky";
import { TILE } from "@/lib/island/tiles/paint";
import { CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/**
 * The island's WebGL2 painter (ADR 0047, D2): it holds every chunk's buffers,
 * draws the sky, the solid pass and the water pass into a small framebuffer,
 * and enlarges it to the screen with nearest sampling. Its atlas is painted
 * for the learner's season. None when the browser
 * has no WebGL2.
 */
export function createPainter(canvas: HTMLCanvasElement, season: Season) {
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
      programOf(gl, WEATHER_VERTEX, WEATHER_FRAGMENT),
      programOf(gl, OUTLINE_VERTEX, OUTLINE_FRAGMENT),
      programOf(gl, EDGE_VERTEX, EDGE_FRAGMENT),
      programOf(gl, BODY_VERTEX, BODY_FRAGMENT),
    ]),
    ([
      chunkProgram,
      skyProgram,
      weatherProgram,
      outlineProgram,
      edgeProgram,
      bodyProgram,
    ]) => {
      const atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      // Each tile's own smaller levels (D20): a far face shows its color, not the noise of its pixels.
      const levels = mipsOf(
        repaintFor(atlasPixels(), season),
        ATLAS_SIZE,
        TILE
      );
      Arr.forEach(levels, (pixels, level) =>
        gl.texImage2D(
          gl.TEXTURE_2D,
          level,
          gl.RGBA,
          ATLAS_SIZE / 2 ** level,
          ATLAS_SIZE / 2 ** level,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels
        )
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, levels.length - 1);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.NEAREST_MIPMAP_NEAREST
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // The scene's colors, faces and depth, then the frame the edge pass and the weather paint (D20).
      const target = createFrame(gl, canvas);
      const chunks = Arr.makeBy(CHUNKS * CHUNKS, () => ({
        solid: Option.none<ReturnType<typeof uploadList>>(),
        water: Option.none<ReturnType<typeof uploadList>>(),
      }));
      const sea = uploadList(gl, seaRing(SEA_LEVEL - 0.125, [0, 0], 1));
      const sandSlot = SLOTS.sand;
      const floor = uploadList(
        gl,
        seaRing(
          SEA_LEVEL - 5,
          [
            ((sandSlot % ATLAS_TILES) + 0.5) / ATLAS_TILES,
            (Math.floor(sandSlot / ATLAS_TILES) + 0.5) / ATLAS_TILES,
          ],
          0.35
        )
      );
      const uniform = (name: string) =>
        gl.getUniformLocation(chunkProgram, name);
      const weather = uploadWeather(gl);
      const outline = uploadOutline(gl);
      const herd = uploadMoving(gl, 64);
      const bodies = createBodies(gl);
      const bodyUniform = (name: string) =>
        gl.getUniformLocation(bodyProgram, name);
      const outlineUniform = (name: string) =>
        gl.getUniformLocation(outlineProgram, name);
      const weatherUniform = (name: string) =>
        gl.getUniformLocation(weatherProgram, name);
      const skyUniform = (name: string) =>
        gl.getUniformLocation(skyProgram, name);
      const waterSlot = SLOTS.water;
      const waterTile = [
        waterSlot % ATLAS_TILES,
        Math.floor(waterSlot / ATLAS_TILES),
      ] as const;

      /** Draws the sky over the whole frame, from the horizon's color to the zenith's. */
      const drawSky = (light: Light) => {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        activate(gl, skyProgram);
        gl.uniform3fv(skyUniform("uZenith"), light.zenith);
        gl.uniform3fv(skyUniform("uHorizon"), light.horizon);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      /**
       * Draws every true 3D body (D21): first each one's shadow, a dark disc
       * pressed onto the ground that writes no depth and no edges, then the
       * bodies themselves, lit flat and edged like the blocks.
       */
      const drawBodies = (
        orbit: Orbit,
        light: Light,
        time: number,
        camera: Float32Array
      ) => {
        activate(gl, bodyProgram);
        gl.uniformMatrix4fv(bodyUniform("uViewProjection"), false, camera);
        gl.uniform1f(bodyUniform("uTime"), time);
        gl.uniform3fv(bodyUniform("uSun"), light.sun);
        gl.uniform3fv(bodyUniform("uAmbient"), light.ambient);
        gl.uniform3fv(bodyUniform("uFog"), light.fog);
        gl.uniform2f(
          bodyUniform("uFogRange"),
          orbit.distance + 30,
          orbit.distance + 160
        );
        gl.uniform3fv(bodyUniform("uEye"), eyeOf(orbit));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
        gl.uniform1f(bodyUniform("uShadow"), 1);
        bodies.draw();
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.enable(gl.CULL_FACE);
        gl.uniform1f(bodyUniform("uShadow"), 0);
        bodies.draw();
        gl.disable(gl.CULL_FACE);
      };

      /** Draws one pass of every chunk's lists. */
      const drawLists = (pass: "solid" | "water") => {
        for (const chunk of chunks) {
          Option.map(chunk[pass], (list) => {
            gl.bindVertexArray(list.vao);
            gl.drawElements(gl.TRIANGLES, list.count, gl.UNSIGNED_INT, 0);
          });
        }
      };

      /** Draws the sea floor and every solid face, then the water over them. */
      const drawWorld = (
        orbit: Orbit,
        light: Light,
        time: number,
        camera: Float32Array
      ) => {
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.CULL_FACE);
        activate(gl, chunkProgram);
        gl.uniformMatrix4fv(uniform("uViewProjection"), false, camera);
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
        drawLists("solid");
        gl.disable(gl.CULL_FACE);
        gl.bindVertexArray(herd.vao);
        gl.drawElements(gl.TRIANGLES, herd.count(), gl.UNSIGNED_INT, 0);
        drawBodies(orbit, light, time, camera);
        activate(gl, chunkProgram);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        // Water tints what lies under it but keeps those faces' edges (D20).
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
        gl.uniform1f(uniform("uWater"), 1);
        gl.uniform1f(uniform("uAlpha"), 0.9);
        drawLists("water");
        gl.bindVertexArray(sea.vao);
        gl.drawElements(gl.TRIANGLES, sea.count, gl.UNSIGNED_INT, 0);
      };

      /** Draws the rain or snow falling around the camera's target. */
      const drawWeather = (
        orbit: Orbit,
        time: number,
        camera: Float32Array,
        fall: Fall
      ) => {
        activate(gl, weatherProgram);
        gl.uniformMatrix4fv(weatherUniform("uViewProjection"), false, camera);
        gl.uniform3fv(weatherUniform("uTarget"), orbit.target);
        gl.uniform1f(weatherUniform("uTime"), time);
        gl.uniform1f(weatherUniform("uSpeed"), fall.speed);
        gl.uniform1f(weatherUniform("uLength"), fall.length);
        gl.uniform1f(weatherUniform("uSway"), fall.sway);
        gl.uniform4fv(weatherUniform("uColor"), fall.color);
        gl.bindVertexArray(weather.vao);
        gl.drawArrays(
          fall.flakes ? gl.POINTS : gl.LINES,
          0,
          Math.min(PARTICLES, fall.count) * 2
        );
      };

      /** Outlines the cell a press would change, over everything but the HUD. */
      const drawOutline = (
        camera: Float32Array,
        cell: readonly [number, number, number]
      ) => {
        gl.disable(gl.DEPTH_TEST);
        activate(gl, outlineProgram);
        gl.uniformMatrix4fv(outlineUniform("uViewProjection"), false, camera);
        gl.uniform3f(outlineUniform("uCell"), cell[0], cell[1], cell[2]);
        gl.uniform4f(outlineUniform("uColor"), 1, 0.96, 0.8, 0.95);
        gl.bindVertexArray(outline.vao);
        gl.drawArrays(gl.LINES, 0, outline.count);
      };

      const edgeUniform = (name: string) =>
        gl.getUniformLocation(edgeProgram, name);

      /** Paints the edged frame from the scene's colors, faces and depth (D20). */
      const drawEdges = (orbit: Orbit, camera: Float32Array) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.final);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        activate(gl, edgeProgram);
        Arr.forEach(
          [target.color, target.surface, target.depth],
          (texture, unit) => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
          }
        );
        gl.uniform1i(edgeUniform("uColor"), 0);
        gl.uniform1i(edgeUniform("uSurface"), 1);
        gl.uniform1i(edgeUniform("uDepth"), 2);
        gl.uniform2f(
          edgeUniform("uTexel"),
          1 / target.width,
          1 / target.height
        );
        gl.uniform2f(edgeUniform("uClip"), CLIP.near, CLIP.far);
        gl.uniformMatrix4fv(edgeUniform("uInverse"), false, invert(camera));
        gl.uniform1f(edgeUniform("uSea"), SEA_LEVEL - 0.2);
        const eye = eyeOf(orbit);
        const ahead = [
          eye[0] - orbit.target[0],
          eye[1] - orbit.target[1],
          eye[2] - orbit.target[2],
        ] as const;
        const length = Math.hypot(ahead[0], ahead[1], ahead[2]);
        gl.uniform3f(
          edgeUniform("uAhead"),
          ahead[0] / length,
          ahead[1] / length,
          ahead[2] / length
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0);
      };

      /**
       * Enlarges the edged frame onto the canvas by a whole number, centered on
       * the horizon's color, moved back by the art pixels the camera's snap
       * rounded away, so a pan glides while the pixels hold still (D20).
       */
      const blit = (light: Light, shift: readonly [number, number]) => {
        const scale = Math.max(
          1,
          Math.floor(
            Math.min(canvas.width / target.width, canvas.height / target.height)
          )
        );
        const left =
          Math.floor((canvas.width - target.width * scale) / 2) +
          Math.round(shift[0] * scale);
        const top =
          Math.floor((canvas.height - target.height * scale) / 2) +
          Math.round(shift[1] * scale);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.final);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.clearColor(light.horizon[0], light.horizon[1], light.horizon[2], 1);
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
      };

      return Option.some({
        /** Replaces the quads of the island's animals. */
        herd(quads: {
          readonly vertices: Float32Array;
          readonly indices: Uint32Array;
        }) {
          herd.write(quads);
        },
        /** Replaces where every true 3D body stands this frame (D21). */
        bodies(next: Parameters<typeof bodies.write>[0]) {
          bodies.write(next);
        },
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
        /** Draws one frame: the sky, every chunk, the water, then the falling weather, enlarged to the canvas. */
        draw(
          orbit: Orbit,
          light: Light,
          time: number,
          sky: Weather,
          aim: Option.Option<readonly [number, number, number]>
        ) {
          target.resize();
          const snapped = snapOrbit(orbit, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame);
          gl.viewport(0, 0, target.width, target.height);
          const camera = viewProjectionOf(
            snapped.orbit,
            target.width / target.height
          );
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
          drawSky(light);
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
          gl.clearBufferfv(gl.COLOR, 1, [0.5, 1, 0.5, 0]);
          drawWorld(snapped.orbit, light, time, camera);
          gl.depthMask(true);
          drawEdges(snapped.orbit, camera);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.overlay);
          gl.enable(gl.DEPTH_TEST);
          gl.enable(gl.BLEND);
          gl.depthMask(false);
          Option.map(fallOf(sky), (fall) =>
            drawWeather(snapped.orbit, time, camera, fall)
          );
          Option.map(aim, (cell) => drawOutline(camera, cell));
          gl.depthMask(true);
          gl.bindVertexArray(null);
          blit(light, snapped.shift);
        },
        /** Lets the GPU go of everything the painter held. */
        release() {
          for (const chunk of chunks) {
            Option.map(chunk.solid, (list) => list.release());
            Option.map(chunk.water, (list) => list.release());
          }
          sea.release();
          weather.release();
          target.release();
          outline.release();
          herd.release();
          bodies.release();
          floor.release();
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
      });
    }
  );
}

/** What the game holds of its painter. */
export type Painter = Option.Option.Value<ReturnType<typeof createPainter>>;
