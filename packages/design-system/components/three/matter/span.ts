import type { BufferGeometry } from "three";
import { Box3, Vector3 } from "three";

/** Below this, a triangle has no area on the part or in its texture coordinates, and says nothing about either. */
const EMPTY = 1e-12;

/** How much more of a part's length must follow one texture direction than the other before the part is said to run that way. */
const CLEARLY = 1.1;

const AXES = ["x", "y", "z"] as const;
const bounds = new Box3();
const size = new Vector3();
const origin = new Vector3();
const first = new Vector3();
const second = new Vector3();
const face = new Vector3();
const across = new Vector3();
const along = new Vector3();

/** Which of a part's own axes it is longest on, from the `places` of its corners. */
function longestOf(places: ReturnType<BufferGeometry["getAttribute"]>) {
  bounds.makeEmpty();
  for (let corner = 0; corner < places.count; corner += 1) {
    bounds.expandByPoint(origin.fromBufferAttribute(places, corner));
  }
  bounds.getSize(size);
  if (size.x >= size.y && size.x >= size.z) {
    return AXES[0];
  }
  return size.y >= size.z ? AXES[1] : AXES[2];
}

/**
 * How a part lies under its texture coordinates, in the part's own units:
 * how far it runs for one unit `across` them and for one unit `along` them,
 * each triangle's stretch weighed by its area, and whether the part is
 * `upright`: longest along them, not across them. A cylinder answers its
 * girth and its height, and a rod is upright; a board answers its width and
 * its depth, and is not. A surface whose detail has a real size is laid by
 * this, so the detail is as fine on a large part as on a small one, and a
 * grain can follow the part. A part without texture coordinates answers one
 * unit each way and is not upright.
 */
export function spanOf(geometry: BufferGeometry) {
  const place = geometry.getAttribute("position");
  const laid = geometry.getAttribute("uv");
  const spans = { across: 0, along: 0, lengthAcross: 0, lengthAlong: 0 };
  if (place === undefined || laid === undefined) {
    return { across: 1, along: 1, upright: false };
  }
  const longest = longestOf(place);
  const corners = geometry.getIndex();
  const count = corners === null ? place.count : corners.count;
  let whole = 0;
  for (let corner = 0; corner + 2 < count; corner += 3) {
    const a = corners === null ? corner : corners.getX(corner);
    const b = corners === null ? corner + 1 : corners.getX(corner + 1);
    const c = corners === null ? corner + 2 : corners.getX(corner + 2);
    origin.fromBufferAttribute(place, a);
    first.fromBufferAttribute(place, b).sub(origin);
    second.fromBufferAttribute(place, c).sub(origin);
    const firstU = laid.getX(b) - laid.getX(a);
    const firstV = laid.getY(b) - laid.getY(a);
    const secondU = laid.getX(c) - laid.getX(a);
    const secondV = laid.getY(c) - laid.getY(a);
    const area = face.crossVectors(first, second).length() / 2;
    const turn = firstU * secondV - secondU * firstV;
    if (area > EMPTY && Math.abs(turn) > EMPTY) {
      across
        .copy(first)
        .multiplyScalar(secondV)
        .addScaledVector(second, -firstV);
      along
        .copy(second)
        .multiplyScalar(firstU)
        .addScaledVector(first, -secondU);
      spans.across += (area * across.length()) / Math.abs(turn);
      spans.along += (area * along.length()) / Math.abs(turn);
      spans.lengthAcross +=
        (area * Math.abs(across[longest])) / across.length();
      spans.lengthAlong += (area * Math.abs(along[longest])) / along.length();
      whole += area;
    }
  }
  if (whole === 0) {
    return { across: 1, along: 1, upright: false };
  }
  return {
    across: spans.across / whole,
    along: spans.along / whole,
    upright: spans.lengthAlong > spans.lengthAcross * CLEARLY,
  };
}
