import { Array as Arr } from "effect";

/**
 * The triangles of a surface laid out as rows of `sides + 1` vertices, each
 * row joined to the next, facing out of a row that winds from its first
 * column round to its last. `widths` holds how wide each row is: a row of no
 * width is pinched to one point, a pole or the middle of a cap, and takes one
 * triangle a side instead of two. A row named in `breaks` is not joined to
 * the next: the two stand in the same place and keep a crisp edge between
 * them, as a flat cap meets the side it closes.
 *
 * @param sides - Faces around each row
 * @param widths - The width of every row, in order
 * @param breaks - The rows the surface breaks after
 */
export function stitch(
  sides: number,
  widths: readonly number[],
  breaks: readonly number[]
) {
  const columns = sides + 1;
  const faces = Arr.flatMap(Arr.dropRight(widths, 1), (width, row) =>
    Arr.contains(breaks, row)
      ? []
      : Arr.flatMap(
          Arr.makeBy(sides, (side) => row * columns + side),
          (a) => {
            const b = a + columns;
            return [
              ...(width > 0 ? [a, a + 1, b] : []),
              ...(widths[row + 1] > 0 ? [b, a + 1, b + 1] : []),
            ];
          }
        )
  );
  return widths.length * columns > 65_535
    ? new Uint32Array(faces)
    : new Uint16Array(faces);
}
