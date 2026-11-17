import { Option } from "effect";
import { createAir } from "@/components/island/air";
import { createAtlas } from "@/components/island/atlas";
import {
  activate,
  programOf,
  uploadOutline,
} from "@/components/island/buffers";
import { createEdges } from "@/components/island/edges";
import { createFrame } from "@/components/island/frame";
import { createLife } from "@/components/island/life";
import { createShadow } from "@/components/island/shadow";
import { createTerrain } from "@/components/island/terrain";
import { createGale } from "@/components/island/wind";
import { eyeOf, type Orbit, snapOrbit } from "@/lib/island/camera";
import { butterfliesOf, crownsOf } from "@/lib/island/drift";
import { viewProjectionOf } from "@/lib/island/matrix";
import { firefliesOf } from "@/lib/island/night";
import { RUNGS } from "@/lib/island/quality";
import type { Season } from "@/lib/island/season";
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
import { chimneysOf } from "@/lib/island/smoke";
import { flashed, flashOf } from "@/lib/island/storm";
import { sunViewOf } from "@/lib/island/sun";
import type { Cells } from "@/lib/island/world";

/** The texture unit the sun's shadow map takes (D43). */
const SHADOW = 4;

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

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
      const atlas = createAtlas(gl, season);
      // The scene's colors, faces and depth, then the frame the edge pass and the weather paint (D20).
      const target = createFrame(gl, canvas);
      const terrain = createTerrain(gl, chunkProgram, atlas.texture);
      const life = createLife(gl, bodyProgram);
      // What the quality ladder lets the painter draw (D44), and whether the shadow map was last left empty.
      let rung: (typeof RUNGS)[number] = RUNGS[0];
      let emptied = false;
      const gale = createGale(gl);
      // What moves in the air: the weather, the chimneys' smoke and the fireflies (D33, D36).
      const airborne = createAir(
        gl,
        gale,
        atlas.painted,
        terrain.columns,
        season
      );
      if (Option.isNone(airborne)) {
        return Option.none();
      }
      const air = airborne.value;
      const outline = uploadOutline(gl);
      const outlineUniform = (name: string) =>
        gl.getUniformLocation(outlineProgram, name);
      const skyUniform = (name: string) =>
        gl.getUniformLocation(skyProgram, name);

      /** Draws the sky over the whole frame, from the horizon's color to the zenith's. */
      const drawSky = (light: Light) => {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        activate(gl, skyProgram);
        gl.uniform3fv(skyUniform("uZenith"), light.zenith);
        gl.uniform3fv(skyUniform("uHorizon"), light.horizon);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      /** Gives a program the light every lit pass shares: the eye, the sun and the sky, the fog's range and the sun's shadow map (D43). */
      const lightFor =
        (orbit: Orbit, light: Light, sun: ReturnType<typeof sunViewOf>) =>
        (at: Uniforms) => {
          gl.uniform3fv(at("uEye"), eyeOf(orbit));
          gl.uniform3fv(at("uSun"), light.sun);
          gl.uniform3fv(at("uAmbient"), light.ambient);
          gl.uniform3fv(at("uZenith"), light.zenith);
          gl.uniform3fv(at("uHorizon"), light.horizon);
          gl.uniform1f(at("uRows"), target.height);
          gl.uniform2f(
            at("uFogRange"),
            orbit.distance + 30,
            orbit.distance + 160
          );
          shadow.shine(at, light, sun, SHADOW);
        };

      /** Draws the ground, the island's life among it, and the water over them (D2). */
      const drawWorld = (
        orbit: Orbit,
        light: Light,
        time: number,
        sky: Weather,
        camera: Float32Array,
        sun: ReturnType<typeof sunViewOf>
      ) => {
        const shared = lightFor(orbit, light, sun);
        const wind = (at: Uniforms) => gale.blow(at, time, sky);
        shadow.bind(SHADOW);
        terrain.draw({
          between: () => {
            life.flat();
            life.draw(camera, time, wind, shared);
          },
          camera,
          frame: target,
          lit: (at) => {
            shared(at);
            gl.uniform3fv(at("uLamp"), light.lamp);
            gl.uniform1f(at("uTime"), time);
            wind(at);
            air.cover(at);
          },
          tufts: rung.tufts,
        });
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
        /** Replaces the flat quads of Nina and the float. */
        herd: life.quads,
        /** Sets the other isles of the archipelago, drawn with the blocks from then on (D23). */
        isles: terrain.isles,
        /** Throws the dust or the chips of one changed block (D38), on the clock the frames are drawn on. */
        burst: air.burst,
        /** Replaces what the cells decide beside the chunks (D53): the column map (D39), the coast map (D51), the air's scenery (D33, D36). */
        world(cells: Cells, seed: number) {
          terrain.maps(cells);
          air.scenery({
            butterflies: butterfliesOf(cells, seed),
            chimneys: chimneysOf(cells),
            crowns: crownsOf(cells),
            fireflies: firefliesOf(cells, seed),
          });
        },
        /** Replaces where every true 3D body stands this frame (D21). */
        bodies: life.bodies,
        /** Replaces one chunk's buffers with its new mesh. */
        upload: terrain.upload,
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
          target.resize(orbit.distance, rung.coarse);
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
              terrain.cast();
              life.cast(sun.matrix, time, (at) => gale.blow(at, time, sky));
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
          terrain.release();
          life.release();
          shadow.release();
          edges.release();
          gale.release();
          air.release();
          target.release();
          outline.release();
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
      });
    }
  );
}

/** What the game holds of its painter. */
export type Painter = Option.Option.Value<ReturnType<typeof createPainter>>;
