import { eyeOf, FIELD_OF_VIEW, type Orbit } from "@/lib/island/camera";

/** A 4 by 4 matrix in column-major order, as WebGL reads it. */
type Matrix = Float32Array;

/** The product `a` times `b`. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row] * b[column * 4 + k];
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** A perspective projection with WebGL's clip space. */
export function perspective(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Matrix {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * range,
    -1,
    0,
    0,
    2 * far * near * range,
    0,
  ]);
}

/** The view from `eye` looking at `target`, with the world's up kept up. */
export function lookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number]
): Matrix {
  const f = normalize([
    target[0] - eye[0],
    target[1] - eye[1],
    target[2] - eye[2],
  ]);
  const s = normalize([-f[2], 0, f[0]]);
  const u = [
    s[1] * f[2] - s[2] * f[1],
    s[2] * f[0] - s[0] * f[2],
    s[0] * f[1] - s[1] * f[0],
  ];
  return new Float32Array([
    s[0],
    u[0],
    -f[0],
    0,
    s[1],
    u[1],
    -f[1],
    0,
    s[2],
    u[2],
    -f[2],
    0,
    -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]),
    -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
    f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2],
    1,
  ]);
}

/** A vector scaled to length 1. */
export function normalize(vector: readonly [number, number, number]) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length] as const;
}

/** The inverse of a matrix, by cofactors; the identity's for a singular one. */
export function invert(m: Matrix): Matrix {
  const out = new Float32Array(16);
  const [
    a00,
    a01,
    a02,
    a03,
    a10,
    a11,
    a12,
    a13,
    a20,
    a21,
    a22,
    a23,
    a30,
    a31,
    a32,
    a33,
  ] = m;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const determinant =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  const inverse = determinant === 0 ? 0 : 1 / determinant;
  out.set([
    (a11 * b11 - a12 * b10 + a13 * b09) * inverse,
    (a02 * b10 - a01 * b11 - a03 * b09) * inverse,
    (a31 * b05 - a32 * b04 + a33 * b03) * inverse,
    (a22 * b04 - a21 * b05 - a23 * b03) * inverse,
    (a12 * b08 - a10 * b11 - a13 * b07) * inverse,
    (a00 * b11 - a02 * b08 + a03 * b07) * inverse,
    (a32 * b02 - a30 * b05 - a33 * b01) * inverse,
    (a20 * b05 - a22 * b02 + a23 * b01) * inverse,
    (a10 * b10 - a11 * b08 + a13 * b06) * inverse,
    (a01 * b08 - a00 * b10 - a03 * b06) * inverse,
    (a30 * b04 - a31 * b02 + a33 * b00) * inverse,
    (a21 * b02 - a20 * b04 - a23 * b00) * inverse,
    (a11 * b07 - a10 * b09 - a12 * b06) * inverse,
    (a00 * b09 - a01 * b07 + a02 * b06) * inverse,
    (a31 * b01 - a30 * b03 - a32 * b00) * inverse,
    (a20 * b03 - a21 * b01 + a22 * b00) * inverse,
  ]);
  return out;
}

/** The nearest and farthest the camera sees; the edge pass reads depth by them too (D20). */
export const CLIP = { far: 3000, near: 0.5 } as const;

/** The camera's projection and view in one matrix, for a screen of this aspect. */
export function viewProjectionOf(orbit: Orbit, aspect: number) {
  const projection = perspective(FIELD_OF_VIEW, aspect, CLIP.near, CLIP.far);
  return multiply(projection, lookAt(eyeOf(orbit), orbit.target));
}

/**
 * The ray from the camera through a point of the screen, the point given in
 * clip coordinates from -1 to 1 (up is positive).
 */
export function rayThrough(
  orbit: Orbit,
  aspect: number,
  clipX: number,
  clipY: number
) {
  const inverse = invert(viewProjectionOf(orbit, aspect));
  const unproject = (z: number) => {
    const x =
      inverse[0] * clipX + inverse[4] * clipY + inverse[8] * z + inverse[12];
    const y =
      inverse[1] * clipX + inverse[5] * clipY + inverse[9] * z + inverse[13];
    const w =
      inverse[3] * clipX + inverse[7] * clipY + inverse[11] * z + inverse[15];
    const depth =
      inverse[2] * clipX + inverse[6] * clipY + inverse[10] * z + inverse[14];
    return [x / w, y / w, depth / w] as const;
  };
  const near = unproject(-1);
  const far = unproject(1);
  return {
    direction: normalize([
      far[0] - near[0],
      far[1] - near[1],
      far[2] - near[2],
    ]),
    origin: near,
  };
}
