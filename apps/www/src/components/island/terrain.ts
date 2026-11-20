import { Array as Arr, Option, Schema } from "effect";
import { activate, programOf } from "@/components/island/buffers";
import type { createFrame } from "@/components/island/frame";
import {
  BLADE_FRAGMENT,
  BLADE_VERTEX,
  LAMPS,
  LAND_FRAGMENT,
  LAND_VERTEX,
  MEADOW,
  SHADE_FRAGMENT,
  SHADE_VERTEX,
} from "@/lib/island/land/glsl";
import { SEA } from "@/lib/island/land/relief";
import type { Window } from "@/lib/island/land/window";
import { HORIZON_STEP, WINDOW } from "@/lib/island/land/window";
import { CLIP } from "@/lib/island/matrix";
import { unitOf } from "@/lib/island/noise";

/** The texture units the land's passes read: the window's ground and its cover, the horizon's, the depth under the water (D43) and the scene still water mirrors (D51). The wind's lean map holds 2 and the sun's shadow map 4. */
const UNIT = {
  far: 5,
  farKinds: 7,
  fields: 0,
  kinds: 3,
  scene: 6,
  seabed: 1,
} as const;

/** The grid leaves this many lattice points of the window out on every side, so a corner's neighbours are always inside it. */
const RIM = 2;

/** How many blades of grass the patch around the camera holds. */
const BLADES = 150_000;

/** A uniform finder of a program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/** The ring laid on the ground under a brush or a thing in hand: its middle, how far it reaches, its tint, and 1 while it shows. */
export const Ring = Schema.Struct({
  reach: Schema.Finite,
  shown: Schema.Finite,
  tint: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  x: Schema.Finite,
  z: Schema.Finite,
});
export type Ring = typeof Ring.Type;

/** One grid over a level of the land: a corner for each lattice point inside the rim, as its place from the level's origin in the level's steps, two triangles a cell. */
function gridOf() {
  const side = WINDOW - 2 * RIM;
  const points = new Float32Array(side * side * 2);
  const indices = new Uint32Array((side - 1) * (side - 1) * 6);
  for (let j = 0; j < side; j += 1) {
    for (let i = 0; i < side; i += 1) {
      points[(j * side + i) * 2] = i + RIM - WINDOW / 2;
      points[(j * side + i) * 2 + 1] = j + RIM - WINDOW / 2;
    }
  }
  for (let j = 0; j < side - 1; j += 1) {
    for (let i = 0; i < side - 1; i += 1) {
      const corner = j * side + i;
      indices.set(
        [
          corner,
          corner + side,
          corner + 1,
          corner + 1,
          corner + side,
          corner + side + 1,
        ],
        (j * (side - 1) + i) * 6
      );
    }
  }
  return { indices, points };
}

/** Every blade's own numbers: where in the patch its root lies, and two numbers from 0 to 1 that set its height, its width and whether it flowers. */
function bladesOf() {
  const blades = new Float32Array(BLADES * 4);
  for (let index = 0; index < BLADES; index += 1) {
    blades[index * 4] = unitOf(77, index, 1) * MEADOW;
    blades[index * 4 + 1] = unitOf(77, index, 2) * MEADOW;
    blades[index * 4 + 2] = unitOf(77, index, 3);
    blades[index * 4 + 3] = unitOf(77, index, 4);
  }
  return blades;
}

/** A texture of a level of the land, read smoothly between its lattice points. */
function windowTexture(gl: WebGL2RenderingContext, inner: number) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, inner, WINDOW, WINDOW);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/**
 * The land on the GPU (ADR 0050, W10): one grid, drawn once over the window
 * of land around the camera and once over the horizon past it, raised by each
 * level's own textures, so a change to the land is two texture writes and no
 * mesh is ever rebuilt; and the blades of grass in the patch around the
 * camera. It draws the solid ground, the blades, then `between` (everything
 * that stands on the land), then the water over them. None when the driver
 * refuses one of its programs.
 */
export function createTerrain(gl: WebGL2RenderingContext) {
  return Option.map(
    Option.all([
      programOf(gl, LAND_VERTEX, LAND_FRAGMENT),
      programOf(gl, SHADE_VERTEX, SHADE_FRAGMENT),
      programOf(gl, BLADE_VERTEX, BLADE_FRAGMENT),
    ]),
    ([landProgram, shadeProgram, bladeProgram]) => {
      const grid = gridOf();
      const gridVao = gl.createVertexArray();
      const pointBuffer = gl.createBuffer();
      const indexBuffer = gl.createBuffer();
      gl.bindVertexArray(gridVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, grid.points, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);

      // A blade: two corners at its foot, two at its waist and its tip.
      const bladeVao = gl.createVertexArray();
      const cornerBuffer = gl.createBuffer();
      const bladeBuffer = gl.createBuffer();
      gl.bindVertexArray(bladeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, 0, 1, 0, -0.7, 0.55, -0.7, 0.55, 1, 0, 0.7, 0.55, -0.7, 0.55, 0.7,
          0.55, 0, 1,
        ]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bladeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, bladesOf(), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.bindVertexArray(null);

      const fields = windowTexture(gl, gl.RGBA16F);
      const kinds = windowTexture(gl, gl.RGBA8);
      const far = windowTexture(gl, gl.RGBA16F);
      const farKinds = windowTexture(gl, gl.RGBA8);
      const lamps = new Float32Array(LAMPS * 4);
      const state = { farX: 0, farZ: 0, originX: 0, originZ: 0 };

      /** Tells a program which level of the land it draws: the window, or the horizon past it. */
      const level = (at: Uniforms, horizon: boolean) => {
        gl.uniform1i(at("uFields"), horizon ? UNIT.far : UNIT.fields);
        gl.uniform1i(at("uKinds"), horizon ? UNIT.farKinds : UNIT.kinds);
        gl.uniform2f(
          at("uOrigin"),
          horizon ? state.farX : state.originX,
          horizon ? state.farZ : state.originZ
        );
        gl.uniform1f(at("uStep"), horizon ? HORIZON_STEP : 1);
        gl.uniform1f(at("uLevel"), horizon ? 1 : 0);
      };

      /** Puts the land's textures on their units and hands a program the window and the horizon it eases into. */
      const bindWindow = (at: Uniforms) => {
        Arr.forEach(
          [
            [UNIT.kinds, kinds],
            [UNIT.far, far],
            [UNIT.farKinds, farKinds],
            [UNIT.fields, fields],
          ] as const,
          ([unit, texture]) => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
          }
        );
        gl.uniform1i(at("uFar"), UNIT.far);
        gl.uniform1i(at("uFarKinds"), UNIT.farKinds);
        gl.uniform2f(at("uNear"), state.originX, state.originZ);
        gl.uniform2f(at("uFarOrigin"), state.farX, state.farZ);
        level(at, false);
      };

      /** Writes a level of the land into its two textures. */
      const write = (
        ground: WebGLTexture,
        cover: WebGLTexture,
        next: Window
      ) => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.bindTexture(gl.TEXTURE_2D, ground);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          WINDOW,
          WINDOW,
          gl.RGBA,
          gl.FLOAT,
          next.fields
        );
        gl.bindTexture(gl.TEXTURE_2D, cover);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          WINDOW,
          WINDOW,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          next.kinds
        );
      };

      /** Draws the grid's triangles with the program in use. */
      const drawGrid = () => {
        gl.bindVertexArray(gridVao);
        gl.drawElements(gl.TRIANGLES, grid.indices.length, gl.UNSIGNED_INT, 0);
      };

      const land: Uniforms = (name) => gl.getUniformLocation(landProgram, name);
      const shade: Uniforms = (name) =>
        gl.getUniformLocation(shadeProgram, name);
      const blade: Uniforms = (name) =>
        gl.getUniformLocation(bladeProgram, name);

      return {
        /** Draws the land into the sun's shadow map from its view `sun` (D43). */
        cast(sun: Float32Array) {
          activate(gl, shadeProgram);
          gl.uniformMatrix4fv(shade("uViewProjection"), false, sun);
          bindWindow(shade);
          drawGrid();
        },
        /**
         * Draws the ground from `camera`, lit by `lit`, the blades around
         * `focus` when `blades` allows them (D44), then `between`, then the
         * water over them, which reads the depth and the colors the solid
         * passes left in `frame` (D43, D51).
         */
        draw({
          between,
          blades,
          camera,
          eye,
          focus,
          frame,
          lit,
          ring,
          turf,
        }: {
          readonly between: () => void;
          readonly blades: boolean;
          readonly camera: Float32Array;
          readonly eye: readonly [number, number, number];
          readonly focus: readonly [number, number, number];
          readonly frame: ReturnType<typeof createFrame>;
          readonly lit: (at: Uniforms) => void;
          readonly ring: Ring;
          readonly turf: readonly [number, number, number];
        }) {
          gl.enable(gl.DEPTH_TEST);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          gl.disable(gl.CULL_FACE);
          const shared = (at: Uniforms) => {
            gl.uniformMatrix4fv(at("uViewProjection"), false, camera);
            bindWindow(at);
            gl.uniform3fv(at("uFocus"), focus);
            gl.uniform3fv(at("uTurf"), turf);
            gl.uniform4fv(at("uLamps"), lamps);
            lit(at);
          };
          activate(gl, landProgram);
          shared(land);
          gl.uniform1f(land("uSea"), SEA);
          gl.uniform4f(land("uRing"), ring.x, ring.z, ring.reach, ring.shown);
          gl.uniform3fv(land("uRingTint"), ring.tint);
          gl.uniform2f(land("uClip"), CLIP.near, CLIP.far);
          // The edge pass leaves the frame's own faces on the seabed's unit, which this pass must not read while it draws them.
          gl.activeTexture(gl.TEXTURE0 + UNIT.seabed);
          gl.bindTexture(gl.TEXTURE_2D, frame.seabed);
          gl.activeTexture(gl.TEXTURE0 + UNIT.scene);
          gl.bindTexture(gl.TEXTURE_2D, null);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform1i(land("uSeabed"), UNIT.seabed);
          gl.uniform1i(land("uScene"), UNIT.scene);
          gl.uniform1f(land("uWater"), 0);
          drawGrid();
          level(land, true);
          drawGrid();
          if (blades) {
            activate(gl, bladeProgram);
            shared(blade);
            // Every blade turns its face to the lens, so it reads as one clean leaf.
            const ahead = Math.hypot(focus[0] - eye[0], focus[2] - eye[2]) || 1;
            gl.uniform2f(
              blade("uSide"),
              (focus[2] - eye[2]) / ahead,
              (eye[0] - focus[0]) / ahead
            );
            gl.bindVertexArray(bladeVao);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, BLADES);
          }
          between();
          // The water reads how much of it lies under each pixel from the depth the solid passes left (D43).
          frame.keepSeabed();
          activate(gl, landProgram);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
          gl.disable(gl.CULL_FACE);
          // Water tints what lies under it but keeps those faces' edges (D20).
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
          gl.activeTexture(gl.TEXTURE0 + UNIT.scene);
          gl.bindTexture(gl.TEXTURE_2D, frame.scene);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform1f(land("uWater"), 1);
          level(land, true);
          drawGrid();
          level(land, false);
          drawGrid();
        },
        /** Hands a program the window of land, for the passes in the air that land on it (D33). */
        ground: bindWindow,
        /** Replaces the lamps that light the ground: up to `LAMPS` of them, each its place and how brightly it burns. */
        lamps(next: Float32Array) {
          lamps.fill(0);
          lamps.set(next.subarray(0, LAMPS * 4));
        },
        /** Lets the GPU go of the grid, the blades, the window and the programs. */
        release() {
          Arr.forEach([gridVao, bladeVao], (vao) => gl.deleteVertexArray(vao));
          Arr.forEach(
            [pointBuffer, indexBuffer, cornerBuffer, bladeBuffer],
            (buffer) => gl.deleteBuffer(buffer)
          );
          Arr.forEach([fields, kinds, far, farKinds], (texture) =>
            gl.deleteTexture(texture)
          );
          Arr.forEach([landProgram, shadeProgram, bladeProgram], (program) =>
            gl.deleteProgram(program)
          );
        },
        /** Replaces the horizon the passes read past the window, centred on `origin`. */
        horizon(next: Window, origin: readonly [number, number]) {
          state.farX = origin[0];
          state.farZ = origin[1];
          write(far, farKinds, next);
        },
        /** Replaces the window of land the passes read, centred on `origin`. */
        window(next: Window, origin: readonly [number, number]) {
          state.originX = origin[0];
          state.originZ = origin[1];
          write(fields, kinds, next);
        },
      };
    }
  );
}
