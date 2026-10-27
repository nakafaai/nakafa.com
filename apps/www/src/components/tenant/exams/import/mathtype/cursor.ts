import { Effect, Match, MutableRef, Option, Record as Rec } from "effect";
import { MathTypeUnread } from "@/components/tenant/exams/import/mathtype/errors";
import {
  fieldOf,
  hasFlag,
  wordOf,
} from "@/components/tenant/exams/import/mathtype/flags";

/** The record types of MTEF 5 that only style an equation, by their number. */
const RULER = 7;
const FONT_STYLE_DEF = 8;
const SIZE = 9;
const FULL = 10;
const SUBSYM = 14;
const COLOR = 15;
const COLOR_DEF = 16;
const FONT_DEF = 17;
const EQN_PREFS = 18;
const ENCODING_DEF = 19;
const FUTURE = 100;

/** The option bit of nudge bytes, and the colour options: CMYK instead of RGB, and a name. */
const NUDGE = 0x08;
const COLOR_CMYK = 0x01;
const COLOR_NAMED = 0x04;

/**
 * The bytes after a SIZE record's first byte: a size and a 16-bit delta after 100, a 16-bit point
 * size after 101, and one delta byte after a size of its own.
 */
const SIZE_TAILS: Rec.ReadonlyRecord<string, number> = { 100: 3, 101: 2 };

/** A reader of the equation's bytes in order, which fails once the bytes end. */
export const cursorOf = (bytes: Uint8Array) => {
  const offset = MutableRef.make(0);
  const byte = Effect.suspend(() =>
    Option.match(Option.fromUndefinedOr(bytes[MutableRef.get(offset)]), {
      onNone: () => Effect.fail(new MathTypeUnread({ reason: "truncated" })),
      onSome: (value) => {
        MutableRef.update(offset, (at) => at + 1);
        return Effect.succeed(value);
      },
    })
  );
  return { byte };
};

export type Cursor = ReturnType<typeof cursorOf>;

/** A little-endian 16-bit integer. */
export const pairOf = (cursor: Cursor) =>
  Effect.map(Effect.all([cursor.byte, cursor.byte]), ([low, high]) =>
    wordOf(low, high)
  );

/** An unsigned integer: one byte below 255, or 255 and a 16-bit integer. */
const unsignedOf = (cursor: Cursor) =>
  cursor.byte.pipe(
    Effect.filterOrElse(
      (value) => value !== 0xff,
      () => pairOf(cursor)
    )
  );

/** A signed integer, biased by 128 in one byte, or 255 and a 16-bit integer biased by 32768. */
export const signedOf = (cursor: Cursor) =>
  Effect.flatMap(cursor.byte, (value) =>
    value === 0xff
      ? Effect.map(pairOf(cursor), (wide) => wide - 32_768)
      : Effect.succeed(value - 128)
  );

/** Skips a number of bytes. */
export const skip = (cursor: Cursor, count: number) =>
  Effect.gen(function* () {
    for (let index = 0; index < count; index += 1) {
      yield* cursor.byte;
    }
  });

/** Skips a string that ends with a zero byte. */
export const skipString = (cursor: Cursor) =>
  Effect.gen(function* () {
    let value = yield* cursor.byte;
    while (value !== 0) {
      value = yield* cursor.byte;
    }
  });

/** Skips the nudge of a record that has one: two bytes, or 128 twice and two 16-bit offsets. */
export const skipNudge = (cursor: Cursor, options: number) =>
  Effect.gen(function* () {
    if (!hasFlag(options, NUDGE)) {
      return;
    }
    const dx = yield* cursor.byte;
    const dy = yield* cursor.byte;
    if (dx === 128 && dy === 128) {
      yield* skip(cursor, 4);
    }
  });

/** Skips a ruler body: its count of tab stops, each a type and a 16-bit offset. */
export const skipRuler = (cursor: Cursor) =>
  Effect.flatMap(cursor.byte, (stops) => skip(cursor, stops * 3));

/** Skips a dimension array of the preferences: its count, then nibbles that end each value with F. */
const skipDimensions = (cursor: Cursor) =>
  Effect.gen(function* () {
    const count = yield* cursor.byte;
    let ended = 0;
    while (ended < count) {
      const value = yield* cursor.byte;
      ended += fieldOf(value, 4, 4) === 0xf ? 1 : 0;
      ended += ended < count && fieldOf(value, 0, 4) === 0xf ? 1 : 0;
    }
  });

/** The definition and style records, which only style an equation: each is read past. */
export const skipStyle = (cursor: Cursor, type: number) =>
  Match.value(type).pipe(
    Match.when(FONT_STYLE_DEF, () =>
      Effect.andThen(unsignedOf(cursor), cursor.byte)
    ),
    Match.when(SIZE, () =>
      Effect.flatMap(cursor.byte, (form) =>
        skip(
          cursor,
          Option.getOrElse(Rec.get(SIZE_TAILS, String(form)), () => 1)
        )
      )
    ),
    Match.when(COLOR, () => unsignedOf(cursor)),
    Match.when(COLOR_DEF, () =>
      Effect.gen(function* () {
        const options = yield* cursor.byte;
        yield* skip(cursor, hasFlag(options, COLOR_CMYK) ? 8 : 6);
        if (hasFlag(options, COLOR_NAMED)) {
          yield* skipString(cursor);
        }
      })
    ),
    Match.when(FONT_DEF, () =>
      Effect.andThen(unsignedOf(cursor), skipString(cursor))
    ),
    Match.when(EQN_PREFS, () =>
      Effect.gen(function* () {
        yield* cursor.byte;
        yield* skipDimensions(cursor);
        yield* skipDimensions(cursor);
        const styles = yield* cursor.byte;
        for (let index = 0; index < styles; index += 1) {
          if ((yield* unsignedOf(cursor)) !== 0) {
            yield* cursor.byte;
          }
        }
      })
    ),
    Match.when(ENCODING_DEF, () => skipString(cursor)),
    Match.when(RULER, () => skipRuler(cursor)),
    Match.when(
      (record) => record >= FULL && record <= SUBSYM,
      () => Effect.void
    ),
    Match.when(
      (record) => record >= FUTURE,
      () => Effect.flatMap(unsignedOf(cursor), (length) => skip(cursor, length))
    ),
    Match.orElse(() => Effect.fail(new MathTypeUnread({ reason: "record" })))
  );
