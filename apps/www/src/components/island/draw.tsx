import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { createAir } from "@/components/island/air";
import { createBodies } from "@/components/island/bodies";
import {
  activate,
  programOf,
  seaRing,
  uploadList,
  uploadMap,
  uploadMoving,
  uploadOutline,
} from "@/components/island/buffers";
import { createEdges } from "@/components/island/edges";
import { createFrame } from "@/components/island/frame";
import { createShadow } from "@/components/island/shadow";
import { createGale } from "@/components/island/wind";
import {
  ATLAS_SIZE,
  ATLAS_TILES,
  atlasPixels,
  SLOTS,
} from "@/lib/island/atlas";
import { eyeOf, type Orbit, snapOrbit } from "@/lib/island/camera";
import type { islesMesh } from "@/lib/island/isles";
import { CLIP, viewProjectionOf } from "@/lib/island/matrix";
import type { meshChunk } from "@/lib/island/mesh";
import { mipsOf } from "@/lib/island/mips";
import { RUNGS } from "@/lib/island/quality";
import { repaintFor, type Season } from "@/lib/island/season";
import {
  BODY_FRAGMENT,
  BODY_VERTEX,
  CHUNK_FRAGMENT,
  CHUNK_VERTEX,
  OUTLINE_FRAGMENT,
  OUTLINE_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
} from "@/lib/island/shaders";
import type { Light, Weather } from "@/lib/island/sky";
import { flashed, flashOf } from "@/lib/island/storm";
import { sunViewOf } from "@/lib/island/sun";
import { DEEP } from "@/lib/island/terrain";
import { TILE } from "@/lib/island/tiles/paint";
import { CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/** The learner's own fox, the one body seen through what stands in front of it. */
const FOX = { _tag: "body", kind: "fox" } as const;

/** The texture unit the column map takes while the blocks are drawn: the atlas holds 0, the depth under the water 1, the wind's lean map 2. */
const COLUMNS = 3;

/** The texture unit the sun's shadow map takes (D43). */
const SHADOW = 4;

/** The depth under the water, which the water pass reads (D43). */
const SEABED = 1;

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
      programOf(gl, OUTLINE_VERTEX, OUTLINE_FRAGMENT),
      createEdges(gl),
      programOf(gl, BODY_VERTEX, BODY_FRAGMENT),
      createShadow(gl),
    ]),
    ([
      chunkProgram,
      skyProgram,
      outlineProgram,
      edges,
      bodyProgram,
      shadow,
    ]) => {
      const atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      // Each tile's own smaller levels (D20): a far face shows its color, not the noise of its pixels.
      const painted = repaintFor(atlasPixels(), season);
      const levels = mipsOf(painted, ATLAS_SIZE, TILE);
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
        tufts: Option.none<ReturnType<typeof uploadList>>(),
        water: Option.none<ReturnType<typeof uploadList>>(),
      }));
      // What the quality ladder lets the painter draw (D44), and whether the shadow map was last left empty.
      let rung: (typeof RUNGS)[number] = RUNGS[0];
      let emptied = false;
      const sea = uploadList(gl, seaRing(SEA_LEVEL - 0.125, [0, 0], 1));
      // What tops each column: where a drop stops and which ground the blocks blend (D39).
      const columns = uploadMap(gl, SPAN, 2);
      const gale = createGale(gl);
      // What moves in the air: the weather, the chimneys' smoke and the fireflies (D33, D36).
      const airborne = createAir(gl, gale, painted, columns, season);
      if (Option.isNone(airborne)) {
        return Option.none();
      }
      const air = airborne.value;
      // The other isles of the archipelago (D23): one static list, set once a game.
      let isles = Option.none<ReturnType<typeof uploadList>>();
      const sandSlot = SLOTS.sand;
      const floor = uploadList(
        gl,
        seaRing(
          SEA_LEVEL - DEEP,
          [
            ((sandSlot % ATLAS_TILES) + 0.5) / ATLAS_TILES,
            (Math.floor(sandSlot / ATLAS_TILES) + 0.5) / ATLAS_TILES,
          ],
          0.35
        )
      );
      const uniform = (name: string) =>
        gl.getUniformLocation(chunkProgram, name);
      const outline = uploadOutline(gl);
      const herd = uploadMoving(gl, 64);
      const bodies = createBodies(gl);
      const bodyUniform = (name: string) =>
        gl.getUniformLocation(bodyProgram, name);
      const outlineUniform = (name: string) =>
        gl.getUniformLocation(outlineProgram, name);
      const skyUniform = (name: string) =>
        gl.getUniformLocation(skyProgram, name);
      const waterSlot = SLOTS.water;
      const waterTile = [
        waterSlot % ATLAS_TILES,
        Math.floor(waterSlot / ATLAS_TILES),
      ] as const;

      /** Gives a program the sun's view of the world, the light's direction and the shadow map (D43). */
      const shine = (
        at: (name: string) => WebGLUniformLocation | null,
        light: Light,
        sun: ReturnType<typeof sunViewOf>
      ) => {
        gl.uniformMatrix4fv(at("uSunView"), false, sun.matrix);
        gl.uniform3fv(at("uToward"), light.toward);
        gl.uniform1f(at("uShadowTexel"), sun.texel);
        gl.uniform1i(at("uShadowMap"), SHADOW);
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

      /** Gives the body program the clock and the wind, and the view `camera` it draws from (D21). */
      const startBodies = (
        camera: Float32Array,
        time: number,
        sky: Weather
      ) => {
        activate(gl, bodyProgram);
        gl.uniformMatrix4fv(bodyUniform("uViewProjection"), false, camera);
        gl.uniform1f(bodyUniform("uTime"), time);
        gale.blow(bodyUniform, time, sky);
      };

      /** Draws every true 3D body (D21), lit in the blocks' toon bands and edged like them, its shadow in the sun's shadow map (D43). */
      const drawBodies = (
        orbit: Orbit,
        light: Light,
        time: number,
        sky: Weather,
        camera: Float32Array,
        sun: ReturnType<typeof sunViewOf>
      ) => {
        startBodies(camera, time, sky);
        shine(bodyUniform, light, sun);
        gl.uniform3fv(bodyUniform("uSun"), light.sun);
        gl.uniform3fv(bodyUniform("uAmbient"), light.ambient);
        gl.uniform3fv(bodyUniform("uZenith"), light.zenith);
        gl.uniform3fv(bodyUniform("uHorizon"), light.horizon);
        gl.uniform1f(bodyUniform("uRows"), target.height);
        gl.uniform2f(
          bodyUniform("uFogRange"),
          orbit.distance + 30,
          orbit.distance + 160
        );
        gl.uniform3fv(bodyUniform("uEye"), eyeOf(orbit));
        gl.enable(gl.CULL_FACE);
        bodies.draw(FOX);
        // The learner's fox shows through what stands in front of it as a dithered outline of itself, then draws over that wherever it is in sight (D38).
        gl.depthMask(false);
        gl.depthFunc(gl.GREATER);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
        gl.uniform1f(bodyUniform("uSeen"), 1);
        bodies.drawModel(FOX);
        gl.uniform1f(bodyUniform("uSeen"), 0);
        gl.depthFunc(gl.LESS);
        gl.depthMask(true);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        bodies.drawModel(FOX);
        gl.disable(gl.CULL_FACE);
      };

      /** Draws one pass of every chunk's lists. */
      const drawLists = (pass: "solid" | "tufts" | "water") => {
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
        sky: Weather,
        camera: Float32Array,
        sun: ReturnType<typeof sunViewOf>
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
        gl.uniform3fv(uniform("uZenith"), light.zenith);
        gl.uniform3fv(uniform("uHorizon"), light.horizon);
        gl.uniform1f(uniform("uRows"), target.height);
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
        // The edge pass leaves the frame's own faces on unit 1, which this pass must not read while it draws them.
        gl.activeTexture(gl.TEXTURE0 + SEABED);
        gl.bindTexture(gl.TEXTURE_2D, target.seabed);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uniform("uSeabed"), SEABED);
        gl.uniform2f(uniform("uClip"), CLIP.near, CLIP.far);
        gl.uniform1f(uniform("uSea"), SEA_LEVEL);
        shadow.bind(SHADOW);
        shine(uniform, light, sun);
        columns.bind(COLUMNS);
        gl.uniform1i(uniform("uColumns"), COLUMNS);
        gale.blow(uniform, time, sky);
        air.cover(uniform);
        gl.uniform1f(uniform("uWater"), 0);
        gl.bindVertexArray(floor.vao);
        gl.drawElements(gl.TRIANGLES, floor.count, gl.UNSIGNED_INT, 0);
        drawLists("solid");
        Option.map(isles, (list) => {
          gl.bindVertexArray(list.vao);
          gl.drawElements(gl.TRIANGLES, list.count, gl.UNSIGNED_INT, 0);
        });
        gl.disable(gl.CULL_FACE);
        if (rung.tufts) {
          drawLists("tufts");
        }
        gl.bindVertexArray(herd.vao);
        gl.drawElements(gl.TRIANGLES, herd.count(), gl.UNSIGNED_INT, 0);
        drawBodies(orbit, light, time, sky, camera, sun);
        // The water reads how much of it lies under each pixel from the depth the solid pass left (D43).
        target.keepSeabed();
        activate(gl, chunkProgram);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        // Water tints what lies under it but keeps those faces' edges (D20).
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
        gl.uniform1f(uniform("uWater"), 1);

        drawLists("water");
        gl.bindVertexArray(sea.vao);
        gl.drawElements(gl.TRIANGLES, sea.count, gl.UNSIGNED_INT, 0);
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

      return Option.some({
        /** Replaces the quads of the island's animals. */
        herd(quads: {
          readonly vertices: Float32Array;
          readonly indices: Uint32Array;
        }) {
          herd.write(quads);
        },
        /** Sets the other isles of the archipelago, drawn with the blocks from then on (D23). */
        isles(mesh: ReturnType<typeof islesMesh>) {
          Option.map(isles, (list) => list.release());
          isles = Option.some(uploadList(gl, mesh));
        },
        /** Throws the dust or the chips of one changed block (D38), on the clock the frames are drawn on. */
        burst: air.burst,
        /** Replaces what the blocks decide for the air over them (D33, D36). */
        scenery: air.scenery,
        /** Replaces the column map: where a drop stops and which ground each top blends (D39). */
        columns: columns.write,
        /** Replaces where every true 3D body stands this frame (D21). */
        bodies(next: Parameters<typeof bodies.write>[0]) {
          bodies.write(next);
        },
        /** Replaces one chunk's buffers with its new mesh. */
        upload(index: number, mesh: ReturnType<typeof meshChunk>) {
          const slot = chunks[index];
          for (const pass of ["solid", "tufts", "water"] as const) {
            Option.map(slot[pass], (list) => list.release());
            slot[pass] =
              mesh[pass].indices.length > 0
                ? Option.some(uploadList(gl, mesh[pass]))
                : Option.none();
          }
        },
        /** Draws one frame: the sky, every chunk, the water, then the falling weather, enlarged to the canvas. */
        draw(
          orbit: Orbit,
          daylight: Light,
          time: number,
          sky: Weather,
          aim: Option.Option<readonly [number, number, number]>
        ) {
          // A storm's lightning lights the sky and the shade for an instant (D33).
          const light =
            sky === "storm" ? flashed(daylight, flashOf(time)) : daylight;
          target.resize();
          gale.step(time, sky);
          air.step(time, sky);
          const snapped = snapOrbit(orbit, target.rows);
          // The sun's shadow map first, from its own view of what the camera sees (D43).
          const sun = sunViewOf(snapped.orbit, light.toward);
          // Below the ladder's shadow rung the map is left empty once, so every face reads as lit.
          if (rung.shadows || !emptied) {
            emptied = !rung.shadows;
            shadow.cast(sun.matrix, SHADOW, () => {
              if (!rung.shadows) {
                return;
              }
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, atlas);
              drawLists("solid");
              Option.map(isles, (list) => {
                gl.bindVertexArray(list.vao);
                gl.drawElements(gl.TRIANGLES, list.count, gl.UNSIGNED_INT, 0);
              });
              startBodies(sun.matrix, time, sky);
              bodies.draw();
            });
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame);
          gl.viewport(0, 0, target.width, target.height);
          const camera = viewProjectionOf(
            snapped.orbit,
            target.width / target.height,
            target.lens
          );
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
          drawSky(light);
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
          gl.clearBufferfv(gl.COLOR, 1, [0.5, 1, 0.5, 0]);
          drawWorld(snapped.orbit, light, time, sky, camera, sun);
          gl.depthMask(true);
          edges.draw(target, snapped.orbit, camera);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.overlay);
          gl.enable(gl.DEPTH_TEST);
          gl.enable(gl.BLEND);
          gl.depthMask(false);
          air.draw(snapped.orbit, time, camera, light, sky);
          Option.map(aim, (cell) => drawOutline(camera, cell));
          gl.depthMask(true);
          gl.bindVertexArray(null);
          target.enlarge(light.horizon, snapped.shift);
        },
        /** Sets what the painter draws from the quality ladder's rung (D44). */
        quality(next: (typeof RUNGS)[number]) {
          rung = next;
          emptied = false;
        },
        /** Lets the GPU go of everything the painter held. */
        release() {
          for (const chunk of chunks) {
            Option.map(chunk.solid, (list) => list.release());
            Option.map(chunk.tufts, (list) => list.release());
            Option.map(chunk.water, (list) => list.release());
          }
          sea.release();
          shadow.release();
          edges.release();
          columns.release();
          gale.release();
          Option.map(isles, (list) => list.release());
          air.release();
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
