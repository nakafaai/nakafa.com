import { Array as Arr, Schema } from "effect";
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from "three";

/**
 * The raw mesh of one part of a living body, before it becomes a geometry:
 * three numbers a vertex for `position`, `normal` and `color`, two for `uv`
 * and three corners a triangle in `index`.
 */
const FormSchema = Schema.Struct({
  color: Schema.instanceOf(Float32Array),
  index: Schema.instanceOf(Uint32Array),
  normal: Schema.instanceOf(Float32Array),
  position: Schema.instanceOf(Float32Array),
  uv: Schema.instanceOf(Float32Array),
});
export type Form = typeof FormSchema.Type;

/**
 * Smooth normals for a mesh: every vertex faces the way its triangles do on
 * average, larger triangles counting for more, so a body shades as one
 * surface and never in facets.
 */
export function smoothNormals(position: Float32Array, index: Uint32Array) {
  const normal = new Float32Array(position.length);
  for (let corner = 0; corner < index.length; corner += 3) {
    const a = Number(index[corner]) * 3;
    const b = Number(index[corner + 1]) * 3;
    const c = Number(index[corner + 2]) * 3;
    const ux = Number(position[b]) - Number(position[a]);
    const uy = Number(position[b + 1]) - Number(position[a + 1]);
    const uz = Number(position[b + 2]) - Number(position[a + 2]);
    const vx = Number(position[c]) - Number(position[a]);
    const vy = Number(position[c + 1]) - Number(position[a + 1]);
    const vz = Number(position[c + 2]) - Number(position[a + 2]);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const vertex of [a, b, c]) {
      normal[vertex] = Number(normal[vertex]) + nx;
      normal[vertex + 1] = Number(normal[vertex + 1]) + ny;
      normal[vertex + 2] = Number(normal[vertex + 2]) + nz;
    }
  }
  return normal;
}

/**
 * Makes vertices that lie at one place share one normal: the two edges of a
 * seam, or the whole ring of a closed tip. `groups` lists the vertices of
 * each such place.
 */
export function weldNormals(
  normal: Float32Array,
  groups: readonly (readonly number[])[]
) {
  for (const group of groups) {
    const sum = [0, 0, 0];
    for (const vertex of group) {
      sum[0] = Number(sum[0]) + Number(normal[vertex * 3]);
      sum[1] = Number(sum[1]) + Number(normal[vertex * 3 + 1]);
      sum[2] = Number(sum[2]) + Number(normal[vertex * 3 + 2]);
    }
    for (const vertex of group) {
      normal.set(sum, vertex * 3);
    }
  }
}

/** Scales every normal of a mesh to length one, leaving a vertex no triangle uses facing up. */
export function unitNormals(normal: Float32Array) {
  for (let at = 0; at < normal.length; at += 3) {
    const x = Number(normal[at]);
    const y = Number(normal[at + 1]);
    const z = Number(normal[at + 2]);
    const length = Math.hypot(x, y, z);
    normal.set(
      length > 0 ? [x / length, y / length, z / length] : [0, 1, 0],
      at
    );
  }
}

/**
 * Sets a part on the body at `at`, its length running along `span` and its
 * leading edge facing `lead`: a flipper raked back from a shoulder, a dorsal
 * fin on a back, a lobe of a tail fluke, a limb at its joint.
 */
export function attachForm(
  form: Form,
  at: readonly [number, number, number],
  span: readonly [number, number, number],
  lead: readonly [number, number, number]
): Form {
  const along = new Vector3(...span).normalize();
  const flat = new Vector3(...lead);
  flat.addScaledVector(along, -flat.dot(along)).normalize();
  const through = new Vector3().crossVectors(along, flat);
  const placement = new Matrix4()
    .makeBasis(along, flat, through)
    .setPosition(...at);
  const position = new Float32Array(form.position);
  const normal = new Float32Array(form.normal);
  const point = new Vector3();
  for (let vertex = 0; vertex < position.length; vertex += 3) {
    point
      .fromArray(position, vertex)
      .applyMatrix4(placement)
      .toArray(position, vertex);
    point
      .fromArray(normal, vertex)
      .transformDirection(placement)
      .toArray(normal, vertex);
  }
  return { color: form.color, index: form.index, normal, position, uv: form.uv };
}

/**
 * Fuses the parts of one body into a single geometry, drawn in one call and
 * moved by one stroke: the trunk, its fins or limbs, its head.
 */
export function fuseForms(forms: readonly Form[]) {
  const vertices = Arr.reduce(forms, 0, (sum, form) => sum + form.uv.length / 2);
  const corners = Arr.reduce(forms, 0, (sum, form) => sum + form.index.length);
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const color = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const index = new Uint32Array(corners);
  let vertex = 0;
  let corner = 0;
  for (const form of forms) {
    position.set(form.position, vertex * 3);
    normal.set(form.normal, vertex * 3);
    color.set(form.color, vertex * 3);
    uv.set(form.uv, vertex * 2);
    for (let at = 0; at < form.index.length; at += 1) {
      index[corner + at] = Number(form.index[at]) + vertex;
    }
    vertex += form.uv.length / 2;
    corner += form.index.length;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  geometry.setAttribute("color", new BufferAttribute(color, 3));
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
