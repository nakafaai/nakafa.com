import { Array as Arr, MutableHashMap, Option } from "effect";
import { BODY_STRIDE } from "@/lib/island/bodies";
import { type Model, modelFaces, modelKey } from "@/lib/island/models/kinds";
import { flatten, MODEL_STRIDE } from "@/lib/island/models/parts";

/** How many bodies of one model the GPU first makes room for; a model with more doubles its room. */
const FIRST_ROOM = 8;

/** Bytes in one float. */
const FLOAT = 4;

/** One model on the GPU: its mesh, its place buffer, how many bodies that buffer holds, and how many to draw. */
interface Entry {
  readonly corners: number;
  count: number;
  readonly mesh: WebGLBuffer;
  readonly places: WebGLBuffer;
  room: number;
  readonly vao: WebGLVertexArrayObject;
}

/** Points one per-body attribute of the place buffer at its float within each body's run. */
function placeAttribute(
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  offset: number
) {
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(
    location,
    size,
    gl.FLOAT,
    false,
    BODY_STRIDE * FLOAT,
    offset * FLOAT
  );
  gl.vertexAttribDivisor(location, 1);
}

/** Builds one model's mesh and an empty place buffer for its bodies. */
function entryOf(gl: WebGL2RenderingContext, model: Model): Entry {
  const vertices = flatten(modelFaces(model));
  const vao = gl.createVertexArray();
  const mesh = gl.createBuffer();
  const places = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  Arr.forEach([0, 1, 2], (location) => {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(
      location,
      3,
      gl.FLOAT,
      false,
      MODEL_STRIDE * FLOAT,
      location * 3 * FLOAT
    );
  });
  gl.bindBuffer(gl.ARRAY_BUFFER, places);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    FIRST_ROOM * BODY_STRIDE * FLOAT,
    gl.DYNAMIC_DRAW
  );
  placeAttribute(gl, 3, 4, 0);
  placeAttribute(gl, 4, 1, 4);
  placeAttribute(gl, 5, 1, 5);
  gl.bindVertexArray(null);
  return {
    corners: vertices.length / MODEL_STRIDE,
    count: 0,
    mesh,
    places,
    room: FIRST_ROOM,
    vao,
  };
}

/**
 * Every true 3D body on the GPU (ADR 0047, D21, D24 and D25): one mesh a
 * model, built the first time the world draws that model and kept for the
 * game, and the places of that model's bodies, rewritten every frame, so a
 * model's bodies are drawn in one call however many there are.
 */
export function createBodies(gl: WebGL2RenderingContext) {
  const entries = MutableHashMap.empty<string, Entry>();
  return {
    /** Draws every model's bodies with the program and uniforms already set. */
    draw() {
      MutableHashMap.forEach(entries, (entry) => {
        if (entry.count === 0) {
          return;
        }
        gl.bindVertexArray(entry.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, entry.corners, entry.count);
      });
      gl.bindVertexArray(null);
    },
    /** Lets the GPU go of every mesh and place buffer. */
    release() {
      MutableHashMap.forEach(entries, (entry) => {
        gl.deleteVertexArray(entry.vao);
        gl.deleteBuffer(entry.mesh);
        gl.deleteBuffer(entry.places);
      });
      MutableHashMap.clear(entries);
    },
    /**
     * Replaces where every model's bodies stand this frame. A model missing
     * from the list draws nothing; each model comes once, with all its bodies.
     */
    write(bodies: readonly (readonly [Model, Float32Array])[]) {
      MutableHashMap.forEach(entries, (entry) => {
        entry.count = 0;
      });
      Arr.forEach(bodies, ([model, data]) => {
        const key = modelKey(model);
        const entry = Option.getOrElse(MutableHashMap.get(entries, key), () => {
          const made = entryOf(gl, model);
          MutableHashMap.set(entries, key, made);
          return made;
        });
        entry.count = data.length / BODY_STRIDE;
        gl.bindBuffer(gl.ARRAY_BUFFER, entry.places);
        if (entry.count > entry.room) {
          entry.room = Math.max(entry.count, entry.room * 2);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            entry.room * BODY_STRIDE * FLOAT,
            gl.DYNAMIC_DRAW
          );
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
  };
}
