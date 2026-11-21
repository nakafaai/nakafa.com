import {
  CENTRES,
  outline,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import { Array as Arr, Result } from "effect";

/**
 * Where the myonuclei of each fibre lie, in scene units of 10 µm. The fibre
 * shader draws them from the same rule, so the nuclei a cut passes through
 * line up with the ones seen through the sarcolemma.
 *
 * A fibre's surface is divided into cells, rows along the fibre and columns
 * round it, and each cell holds one nucleus at a hashed place inside it.
 */

/**
 * A myonucleus, in scene units: elongated along the fibre, 14 µm long within
 * the 11 to 25 µm measured in human fibres (Battey et al. 2024, Exp Physiol
 * 109:829), drawn 4 µm wide.
 */
export const NUCLEUS = { length: 1.4, width: 0.4 } as const;

/**
 * The cell each nucleus has to itself on the fibre's surface, in scene units.
 * Each nucleus serves about 2,000 µm² of fibre cross-section (Petrella et al.
 * 2008, J Appl Physiol 104:1736), so a section of 4,500 µm² cuts about 2.2
 * nuclei; with nuclei 14 µm long that is one nucleus to every 6.2 µm of
 * fibre. Cells 34 µm long, five round a perimeter of about 240 µm, give one
 * to every 6.8 µm.
 */
export const CELL = { along: 3.4, around: 4.8 } as const;

/** Points round a fibre's outline, the same count the fibre's mesh uses. */
export const AROUND = 96;

/** 2^32: one more than the largest 32-bit unsigned integer. */
const WORD = 4_294_967_296;

/**
 * The PCG hash of a 32-bit unsigned integer (O'Neill 2014), as GLSL ES 3.0
 * computes it in uint arithmetic, so the shader and this module agree bit for
 * bit. `Math.imul` wraps its arguments to 32 bits, so a sum past 2^32 wraps
 * as uint addition does.
 */
export function pcg(value: number) {
  // biome-ignore-start lint/suspicious/noBitwiseOperators: PCG is defined by 32-bit shifts and XOR, which must match the shader's uint arithmetic bit for bit.
  const state = (Math.imul(value, 747_796_405) + 2_891_336_453) >>> 0;
  const word =
    Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277_803_737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
  // biome-ignore-end lint/suspicious/noBitwiseOperators: the hash ends here.
}

/** A number in [0, 1) for one cell of one fibre, with `salt` to draw several from it. */
export function cellUnit(
  fibre: number,
  row: number,
  column: number,
  salt: number
) {
  const first = pcg(fibre * 7 + salt);
  const second = pcg(first + row);
  return pcg(second + column) / WORD;
}

/**
 * The arc length from the top of fibre `index`'s outline to each of its
 * `AROUND` points, and the whole perimeter, in scene units.
 */
export function arcs(index: number) {
  const points = outline(Arr.getUnsafe(CENTRES, index), AROUND);
  const next = [...Arr.drop(points, 1), ...Arr.take(points, 1)];
  const steps = Arr.map(Arr.zip(points, next), ([[y, z], [nextY, nextZ]]) =>
    Math.hypot(nextY - y, nextZ - z)
  );
  const along = Arr.scan(steps, 0, (sum, step) => sum + step);
  return {
    perimeter: Arr.reduce(steps, 0, (sum, step) => sum + step),
    starts: Arr.dropRight(along, 1),
  };
}

/** How wide each column of cells round fibre `index` is, so a whole number of them closes the ring. */
export function columnWidth(perimeter: number) {
  return perimeter / Math.max(1, Math.round(perimeter / CELL.around));
}

/**
 * The nucleus of one cell of a fibre: where its middle lies along the fibre,
 * from the back cut at `back`, and how far round the outline it lies, as arc
 * length.
 */
export function nucleusAt(
  fibre: number,
  row: number,
  column: number,
  width: number,
  back: number
) {
  return {
    along:
      back +
      (row + 0.5 + (cellUnit(fibre, row, column, 1) - 0.5) * 0.5) * CELL.along,
    arc: (column + 0.5 + (cellUnit(fibre, row, column, 2) - 0.5) * 0.6) * width,
  };
}

/**
 * The nuclei of fibre `index` that a cut across the fibre at `plane` passes
 * through, on a fibre that starts at `back`: each with the angle round the
 * fibre's centre it lies at, and the share of its width the cut finds, 1
 * through its middle.
 */
export function cutNuclei(index: number, plane: number, back: number) {
  const { perimeter, starts } = arcs(index);
  const width = columnWidth(perimeter);
  const row = Math.floor((plane - back) / CELL.along);
  const columns = Math.round(perimeter / width);
  const rows = [row - 1, row, row + 1];
  return Arr.flatMap(rows, (near) =>
    Arr.filterMap(Arr.range(0, columns - 1), (column) => {
      const { along, arc } = nucleusAt(index, near, column, width, back);
      const cut = (2 * (plane - along)) / NUCLEUS.length;
      if (Math.abs(cut) >= 1) {
        return Result.failVoid;
      }
      const step = Arr.reduce(starts, 0, (found, start, at) =>
        start <= arc ? at : found
      );
      const start = Arr.getUnsafe(starts, step);
      const end = Arr.getUnsafe([...Arr.drop(starts, 1), perimeter], step);
      const angle =
        ((step + (arc - start) / (end - start)) / AROUND) * Math.PI * 2;
      return Result.succeed({
        angle,
        share: Math.sqrt(1 - cut * cut),
      });
    })
  );
}
