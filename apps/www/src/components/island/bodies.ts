import { Array as Arr } from "effect";
import { BODY_STRIDE, type bodiesOf } from "@/lib/island/bodies";
import { BodyKind, bodyFaces } from "@/lib/island/models/kinds";
import { flatten, MODEL_STRIDE } from "@/lib/island/models/parts";

/** The most bodies of one kind drawn at once. */
const CAPACITY = 32;

/** Bytes in one float. */
const FLOAT = 4;

/**
 * Every true 3D body on the GPU (ADR 0047, D21): one mesh a kind, built once,
 * and the places of that kind's bodies, rewritten every frame, so a kind's
 * bodies are drawn in one call however many there are.
 */
export function createBodies(gl: WebGL2RenderingContext) {
  const kinds = Arr.map(BodyKind.literals, (kind) => {
    const vertices = flatten(bodyFaces(kind));
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
      CAPACITY * BODY_STRIDE * FLOAT,
      gl.DYNAMIC_DRAW
    );
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, BODY_STRIDE * FLOAT, 0);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(
      4,
      1,
      gl.FLOAT,
      false,
      BODY_STRIDE * FLOAT,
      4 * FLOAT
    );
    gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
    return {
      count: 0,
      corners: vertices.length / MODEL_STRIDE,
      kind,
      mesh,
      places,
      vao,
    };
  });
  return {
    /** Draws every kind's bodies with the program and uniforms already set. */
    draw() {
      Arr.forEach(kinds, (entry) => {
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
      Arr.forEach(kinds, (entry) => {
        gl.deleteVertexArray(entry.vao);
        gl.deleteBuffer(entry.mesh);
        gl.deleteBuffer(entry.places);
      });
    },
    /** Replaces where every kind's bodies stand this frame, up to the capacity of each. */
    write(bodies: ReturnType<typeof bodiesOf>) {
      // Both lists follow BodyKind's order, so each kind meets its own places.
      Arr.forEach(Arr.zip(kinds, bodies), ([entry, [, data]]) => {
        entry.count = Math.min(CAPACITY, data.length / BODY_STRIDE);
        gl.bindBuffer(gl.ARRAY_BUFFER, entry.places);
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          0,
          data.subarray(0, entry.count * BODY_STRIDE)
        );
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
  };
}
