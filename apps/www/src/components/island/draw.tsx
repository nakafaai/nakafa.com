import { Option } from "effect";
import { createAir } from "@/components/island/air";
import { activate, programOf } from "@/components/island/buffers";
import { createEdges } from "@/components/island/edges";
import { createFrame } from "@/components/island/frame";
import { createLife } from "@/components/island/life";
import { createShadow } from "@/components/island/shadow";
import type { Ring } from "@/components/island/terrain";
import { createTerrain } from "@/components/island/terrain";
import { createGale } from "@/components/island/wind";
import type { Orbit } from "@/lib/island/camera";
import { eyeOf, FOG, snapOrbit } from "@/lib/island/camera";
import { viewProjectionOf } from "@/lib/island/matrix";
import { RUNGS } from "@/lib/island/quality";
import type { Season } from "@/lib/island/season";
import { turfOf } from "@/lib/island/season";
import {
  BODY_FRAGMENT,
  BODY_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
} from "@/lib/island/shaders";
import type { Light, Weather } from "@/lib/island/sky";
import { flashed, flashOf } from "@/lib/island/storm";
import { sunViewOf } from "@/lib/island/sun";

/** The texture unit the sun's shadow map takes (D43). */
const SHADOW = 4;

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/**
 * The world's WebGL2 painter (ADR 0047, D2; ADR 0050, W10): it draws the sky,
 * the land, everything that stands and lives on it and the water over them
 * into a small framebuffer, edges it, and enlarges it to the screen with
 * nearest sampling. Its turf is tinted for the learner's season. None when
 * the browser has no WebGL2 or refuses a program.
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
      programOf(gl, SKY_VERTEX, SKY_FRAGMENT),
      createEdges(gl),
      programOf(gl, BODY_VERTEX, BODY_FRAGMENT),
      createTerrain(gl),
    ]),
    ([skyProgram, edges, bodyProgram, terrain]) => {
      const shadow = createShadow(gl);
      // The scene's colors, faces and depth, then the frame the edge pass and the weather paint (D20).
      const target = createFrame(gl, canvas);
      const life = createLife(gl, bodyProgram);
      // The bodies cast into the shadow map before they are ever lit, so their program reads the map from its own unit from the start: an unset sampler would read the land's window on unit 0, and the driver refuses that draw.
      activate(gl, bodyProgram);
      gl.uniform1i(gl.getUniformLocation(bodyProgram, "uShadowMap"), SHADOW);
      const turf = turfOf(season);
      // What the quality ladder lets the painter draw (D44), and whether the shadow map was last left empty.
      let rung: (typeof RUNGS)[number] = RUNGS[0];
      let emptied = false;
      const gale = createGale(gl);
      // What moves in the air: the weather, the chimneys' smoke, the fireflies, the leaves (D33, D36, D41).
      const airborne = createAir(gl, gale, terrain.ground, season);
      if (Option.isNone(airborne)) {
        return Option.none();
      }
      const air = airborne.value;
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
            orbit.distance + FOG.from,
            orbit.distance + FOG.to
          );
          shadow.shine(at, light, sun, SHADOW);
        };

      return Option.some({
        /** Replaces where every true 3D body stands this frame (D21). */
        bodies: life.bodies,
        /** Throws a burst of dust or chips where the learner changed something (D38). */
        burst: air.burst,
        /** Draws one frame: the sky, the land, its life, the water, then what moves in the air, enlarged to the canvas. */
        draw(
          orbit: Orbit,
          daylight: Light,
          time: number,
          sky: Weather,
          ring: Ring
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
          const wind = (at: Uniforms) => gale.blow(at, time, sky);
          // Below the ladder's shadow rung the map is left empty once, so every face reads as lit.
          if (rung.shadows || !emptied) {
            emptied = !rung.shadows;
            shadow.cast(SHADOW, () => {
              if (!rung.shadows) {
                return;
              }
              terrain.cast(sun.matrix);
              life.cast(sun.matrix, time, wind);
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
          const shared = lightFor(snapped.orbit, light, sun);
          shadow.bind(SHADOW);
          terrain.draw({
            between: () => life.draw(camera, time, wind, shared),
            blades: rung.tufts,
            camera,
            eye: eyeOf(snapped.orbit),
            focus: snapped.orbit.target,
            frame: target,
            lit: (at) => {
              shared(at);
              gl.uniform3fv(at("uLamp"), light.lamp);
              gl.uniform1f(at("uTime"), time);
              wind(at);
              air.cover(at);
            },
            ring,
            turf,
          });
          gl.depthMask(true);
          edges.draw(target, snapped.orbit, camera);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.overlay);
          gl.enable(gl.DEPTH_TEST);
          gl.enable(gl.BLEND);
          gl.depthMask(false);
          air.draw(snapped.orbit, time, camera, light, sky);
          gl.depthMask(true);
          gl.bindVertexArray(null);
          target.enlarge(light.horizon, snapped.shift);
        },
        /** Replaces the lamps that light the ground about the camera. */
        /** Replaces the horizon of land past the window. */
        horizon: terrain.horizon,
        lamps: terrain.lamps,
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
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
        /** Replaces what moves in the air over the land about the camera (D33, D36, D41). */
        scenery: air.scenery,
        /** Replaces the window of land the passes read. */
        window: terrain.window,
      });
    }
  );
}

/** What the game holds of its painter. */
export type Painter = Option.Option.Value<ReturnType<typeof createPainter>>;
