import { Array as Arr } from "effect";
import qrcode from "qrcode-generator";

/**
 * The QR code of a text as an SVG path: one unit square for each dark module, with the module
 * count that sets the view box. The path holds the text alone, so a scan reads only what the
 * caller chose to put in it: a login card's code, or the address that opens a room.
 */
export function qrSquares(text: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const columns = Arr.makeBy(size, (column) => column);
  const squaresIn = (row: number) =>
    Arr.map(
      Arr.filter(columns, (column) => qr.isDark(row, column)),
      (column) => `M${column} ${row}h1v1h-1z`
    );
  const path = Arr.join(
    Arr.flatMap(
      Arr.makeBy(size, (row) => row),
      squaresIn
    ),
    ""
  );
  return { path, size };
}
