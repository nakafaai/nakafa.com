import { Array as Arr, Schema } from "effect";
import qrcode from "qrcode-generator";

/** The part of a login card that the printed card and its QR code both read. */
const CardCode = Schema.Struct({ code: Schema.String });
type CardCode = typeof CardCode.Type;

/**
 * The text that a login card's QR code holds: the formatted code and nothing else.
 * No name, login name, or address goes into the code, so a scan reads only the code.
 */
export function cardQrPayload(card: CardCode) {
  return card.code;
}

/**
 * The QR code of one card as an SVG path: one unit square for each dark module, with
 * the module count that sets the view box. The path holds the payload alone.
 */
export function cardQr(card: CardCode) {
  const qr = qrcode(0, "M");
  qr.addData(cardQrPayload(card));
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
