import { Array as Arr, Option } from "effect";
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
import {
  ATLAS_SIZE,
  ATLAS_TILES,
  atlasPixels,
  SLOTS,
} from "@/lib/island/atlas";
import { eyeOf, type Orbit } from "@/lib/island/camera";
import { viewProjectionOf } from "@/lib/island/matrix";
import type { meshChunk } from "@/lib/island/mesh";
import { repaintFor, type Season } from "@/lib/island/season";
import {
  CHUNK_FRAGMENT,
  CHUNK_VERTEX,
  OUTLINE_FRAGMENT,
  OUTLINE_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
  WEATHER_FRAGMENT,
  WEATHER_VERTEX,
} from "@/lib/island/shaders";
import { type Fall, fallOf, type Light, type Weather } from "@/lib/island/sky";
import { CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/** The art pixel for a screen: a whole number of device pixels, so its short side spans about 270 art pixels. */
function artPixelOf(width: number, height: number) {
  return Math.max(1, Math.round(Math.min(width, height) / 270));
}

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
    ]),
    ([chunkProgram, skyProgram, weatherProgram, outlineProgram]) => {
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
        repaintFor(atlasPixels(), season)
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

      /** Draws the sky over the whole frame, from the horizon's color to the zenith's. */
      const drawSky = (light: Light) => {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        activate(gl, skyProgram);
        gl.uniform3fv(skyUniform("uZenith"), light.zenith);
        gl.uniform3fv(skyUniform("uHorizon"), light.horizon);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
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
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
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
        gl.drawArrays(fall.flakes ? gl.POINTS : gl.LINES, 0, PARTICLES * 2);
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

      /** Enlarges the small frame onto the canvas by a whole number, centered on the horizon's color. */
      const blit = (light: Light) => {
        const scale = Math.max(
          1,
          Math.floor(
            Math.min(canvas.width / target.width, canvas.height / target.height)
          )
        );
        const left = Math.floor((canvas.width - target.width * scale) / 2);
        const top = Math.floor((canvas.height - target.height * scale) / 2);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.frame);
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
          resize();
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame);
          gl.viewport(0, 0, target.width, target.height);
          const camera = viewProjectionOf(orbit, target.width / target.height);
          drawSky(light);
          drawWorld(orbit, light, time, camera);
          Option.map(fallOf(sky), (fall) =>
            drawWeather(orbit, time, camera, fall)
          );
          Option.map(aim, (cell) => drawOutline(camera, cell));
          gl.depthMask(true);
          gl.bindVertexArray(null);
          blit(light);
        },
        /** Lets the GPU go of everything the painter held. */
        release() {
          for (const chunk of chunks) {
            Option.map(chunk.solid, (list) => list.release());
            Option.map(chunk.water, (list) => list.release());
          }
          sea.release();
          weather.release();
          outline.release();
          herd.release();
          floor.release();
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
      });
    }
  );
}

/** What the game holds of its painter. */
export type Painter = Option.Option.Value<ReturnType<typeof createPainter>>;
