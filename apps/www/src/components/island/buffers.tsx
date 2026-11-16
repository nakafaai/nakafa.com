import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { STRIDE } from "@/lib/island/mesh";
import { unitOf } from "@/lib/island/noise";

/**
 * A ring around the world, from its edge to the horizon, at height `y`: the
 * sea's surface, and under it the sea floor, so the open sea looks as deep as
 * the water inside the world. `uv` is the atlas point the floor takes its color from.
 */
export function seaRing(y: number, uv: readonly [number, number], sky: number) {
  const far = 3000;
  const quads = [
    [-far, -far, SPAN + far, 0],
    [-far, SPAN, SPAN + far, SPAN + far],
    [-far, 0, 0, SPAN],
    [SPAN, 0, SPAN + far, SPAN],
  ] as const;
  const vertices = new Float32Array(quads.length * 4 * STRIDE);
  const indices = new Uint32Array(quads.length * 6);
  Arr.forEach(quads, ([x0, z0, x1, z1], index) => {
    const corners = [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ] as const;
    Arr.forEach(corners, ([x, z], corner) => {
      vertices.set(
        [x, y, z, uv[0], uv[1], 1, sky, 0, 0],
        (index * 4 + corner) * STRIDE
      );
    });
    indices.set(
      Arr.map([0, 1, 2, 0, 2, 3], (value) => value + index * 4),
      index * 6
    );
  });
  return { indices, vertices };
}

/**
 * Makes a program the one the next draws use. WebGL names this `useProgram`,
 * which the hook rule would read as a React hook, so it is called through
 * `Reflect.apply`.
 */
export function activate(gl: WebGL2RenderingContext, program: WebGLProgram) {
  Reflect.apply(gl.useProgram, gl, [program]);
}

/** Compiles one program from its two shaders; none when the driver refuses them. */
export function programOf(
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

/** Lays out the bound vertex buffer as the chunk program reads it: position, atlas coordinate, shade, sky light, lamp light, wind. */
function describeVertices(gl: WebGL2RenderingContext) {
  const bytes = STRIDE * 4;
  for (const [location, size, offset] of [
    [0, 3, 0],
    [1, 2, 3],
    [2, 1, 5],
    [3, 1, 6],
    [4, 1, 7],
    [5, 1, 8],
  ] as const) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, bytes, offset * 4);
  }
}

/** Uploads one draw list to the GPU, its vertices laid out as the chunk program reads them. */
export function uploadList(
  gl: WebGL2RenderingContext,
  list: { readonly vertices: Float32Array; readonly indices: Uint32Array }
) {
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, list.vertices, gl.STATIC_DRAW);
  describeVertices(gl);
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

/** How many rain streaks or snowflakes fall around the camera. */
export const PARTICLES = 900;

/**
 * The seeds of the falling weather, two vertices each (the head and the tail
 * of a streak), uploaded once: where across the box it falls, and its phase.
 */
export function uploadWeather(gl: WebGL2RenderingContext) {
  const seeds = new Float32Array(PARTICLES * 2 * 4);
  Arr.forEach(
    Arr.makeBy(PARTICLES, (index) => index),
    (index) => {
      const seed = [
        unitOf(71, index, 1),
        unitOf(71, index, 2),
        unitOf(71, index, 3),
      ];
      seeds.set([...seed, 0, ...seed, 1], index * 8);
    }
  );
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
  gl.bindVertexArray(null);
  return {
    release: () => {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
    },
    vao,
  };
}

/** The twelve edges of a unit cube as line pairs, uploaded once for the outline. */
export function uploadOutline(gl: WebGL2RenderingContext) {
  const corners = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [1, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [1, 1, 0],
    [1, 1, 1],
    [1, 1, 1],
    [0, 1, 1],
    [0, 1, 1],
    [0, 1, 0],
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 1, 1],
  ] as const;
  const vertices = new Float32Array(
    Arr.flatten(Arr.map(corners, (corner) => [...corner]))
  );
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
  gl.bindVertexArray(null);
  return {
    count: corners.length,
    release: () => {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
    },
    vao,
  };
}

/**
 * A draw list the painter rewrites every frame, for things that move such as
 * the herd: its buffers are made once, `capacity` quads large, and refilled.
 */
export function uploadMoving(gl: WebGL2RenderingContext, capacity: number) {
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * 4 * STRIDE * 4, gl.DYNAMIC_DRAW);
  describeVertices(gl);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, capacity * 6 * 4, gl.DYNAMIC_DRAW);
  gl.bindVertexArray(null);
  let count = 0;
  return {
    count: () => count,
    release: () => {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(indexBuffer);
    },
    vao,
    /** Replaces the quads the list draws, up to its capacity. */
    write(next: {
      readonly vertices: Float32Array;
      readonly indices: Uint32Array;
    }) {
      const quads = Math.min(capacity, next.indices.length / 6);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        next.vertices.subarray(0, quads * 4 * STRIDE)
      );
      gl.bufferSubData(
        gl.ELEMENT_ARRAY_BUFFER,
        0,
        next.indices.subarray(0, quads * 6)
      );
      gl.bindVertexArray(null);
      count = quads * 6;
    },
  };
}

/**
 * A map of the ground on the GPU, one or two bytes a texel, read smoothly:
 * the lean map (D32), so neighbouring trees lean alike, and the column map
 * (D39), two bytes a column that the shaders fetch whole.
 * `write` replaces it, `bind` puts it on a texture unit.
 */
export function uploadMap(
  gl: WebGL2RenderingContext,
  side: number,
  channels: 1 | 2
) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const write = (map: Uint8Array) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      channels === 2 ? gl.RG8 : gl.R8,
      side,
      side,
      0,
      channels === 2 ? gl.RG : gl.RED,
      gl.UNSIGNED_BYTE,
      map
    );
  };
  write(new Uint8Array(side * side * channels));
  return {
    bind(unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.activeTexture(gl.TEXTURE0);
    },
    release() {
      gl.deleteTexture(texture);
    },
    write,
  };
}
