import { Animal, DESIGNS } from "@repo/mascot/animal";
import { Ground } from "@repo/mascot/ground";
import { Eyes } from "@repo/mascot/kit";
import { Pose } from "@repo/mascot/pose";
import { Result, Schema, SchemaTransformation } from "effect";

/**
 * One mascot: which animal, in which of its palettes, on which ground, in which
 * pose, and with which eyes. The palette is the index into the animal's own
 * palettes, so it must exist.
 */
export const Mascot = Schema.Struct({
  animal: Animal,
  eyes: Eyes,
  ground: Ground,
  palette: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  pose: Pose,
}).check(
  Schema.makeFilter(({ animal, palette }) =>
    palette < DESIGNS[animal].colors.length
      ? undefined
      : { issue: `${animal} has no palette ${palette}`, path: ["palette"] }
  )
);

/** The index of a palette, spelled as it is written in a code: no sign, no leading zero. */
const PaletteDigits = Schema.String.check(
  Schema.isPattern(/^(?:0|[1-9][0-9]*)$/u)
).pipe(
  Schema.decodeTo(
    Schema.Int,
    SchemaTransformation.transform({ decode: Number, encode: String })
  )
);

/**
 * A mascot as the text that is stored, `animal.palette.ground.pose.eyes`, for
 * example `kucing.0.243e66.kanan.titik`. Decoding text that names no mascot
 * fails; nothing is guessed.
 */
export const Code = Schema.TemplateLiteralParser([
  Animal,
  ".",
  PaletteDigits,
  ".",
  Ground,
  ".",
  Pose,
  ".",
  Eyes,
]).pipe(
  Schema.decodeTo(
    Mascot,
    SchemaTransformation.transform({
      decode: ([animal, , palette, , ground, , pose, , eyes]) => ({
        animal,
        eyes,
        ground,
        palette,
        pose,
      }),
      encode: ({ animal, eyes, ground, palette, pose }) =>
        [animal, ".", palette, ".", ground, ".", pose, ".", eyes] as const,
    })
  )
);

/** Raised when a stored value is not the code of a mascot. */
export class MascotCodeError extends Schema.TaggedError<MascotCodeError>()(
  "MascotCodeError",
  {
    message: Schema.String,
  }
) {}

const decodeCode = Schema.decodeUnknownResult(Code);

/** Reads the mascot that a code names, or fails with a `MascotCodeError`. */
export function decode(input: unknown) {
  return Result.mapError(
    decodeCode(input),
    (error) => new MascotCodeError({ message: error.message })
  );
}

const encodeCode = Schema.encodeSync(Code);

/** Writes the code of a mascot, the form that is stored. */
export function encode(mascot: typeof Mascot.Type) {
  return encodeCode(mascot);
}
