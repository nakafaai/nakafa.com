import type { Chunk } from "@repo/backend/confect/island/chunk";
import {
  Across,
  bareChunk,
  chunkKeyOf,
  isBare,
  MAX_CHUNKS,
  MAX_THINGS,
  Placed,
  POINTS,
} from "@repo/backend/confect/island/chunk";
import type { Thing } from "@repo/backend/confect/island/things";
import { isOpen } from "@repo/backend/confect/island/things";
import { Array as Arr, HashMap, Match, Option, Schema } from "effect";

/** The values one point's lift, paint and clear codes hold beside its index. */
const LIFT_VALUES = 256;
const PAINT_VALUES = 8;
const CLEAR_VALUES = 2;
/** The surfaces a point can be painted, none included. */
const PAINTS = 6;

/** A point and how far it now stands moved: `index * 256 + (eighths + 128)`, eighths from -127 to 127. */
const LiftCode = Schema.Int.check(
  Schema.isBetween({ maximum: POINTS * LIFT_VALUES - 1, minimum: 1 }),
  Schema.makeFilter((code) =>
    code % LIFT_VALUES === 0
      ? "A point moves by -127 to 127 eighths of a block."
      : undefined
  )
);

/** A point and its surface now: `index * 8 + paint`, paint from 0 to 5. */
const PaintCode = Schema.Int.check(
  Schema.isBetween({ maximum: POINTS * PAINT_VALUES - 1, minimum: 0 }),
  Schema.makeFilter((code) =>
    code % PAINT_VALUES < PAINTS
      ? undefined
      : "A point takes a paint of 0 to 5."
  )
);

/** A point and whether its wild plant is cleared now: `index * 2 + flag`, 1 cleared, 0 grown back. */
const ClearCode = Schema.Int.check(
  Schema.isBetween({ maximum: POINTS * CLEAR_VALUES - 1, minimum: 0 })
);

/** The points one stroke may name of each kind: every point of its chunk. */
const stroke = <Code extends Schema.Top>(code: Code) =>
  Schema.Array(code).check(Schema.isMaxLength(POINTS));

/**
 * One change a learner made, as the browser sends it (ADR 0050, W4): a stroke
 * of a brush over one chunk, which sets the points it names; a thing set at a
 * place, which replaces whatever stands there; or the thing at a place taken.
 */
export const Operation = Schema.Union([
  Schema.TaggedStruct("land", {
    clears: stroke(ClearCode),
    cx: Across,
    cz: Across,
    lifts: stroke(LiftCode),
    paints: stroke(PaintCode),
  }),
  Schema.TaggedStruct("set", {
    ...Placed.fields,
    cx: Across,
    cz: Across,
  }),
  Schema.TaggedStruct("take", {
    at: Placed.fields.at,
    cx: Across,
    cz: Across,
  }),
]);
export type Operation = typeof Operation.Type;

/**
 * What became of one operation: done; refused because the learner has not
 * opened the thing's blueprint; or refused because its chunk holds as many
 * things, or its world as many chunks, as one may.
 */
export const Outcome = Schema.Literals(["done", "locked", "full"]);

/** A chunk after one operation, and what became of the operation. */
const applied = (chunk: Chunk, outcome: typeof Outcome.Type) => ({
  chunk,
  outcome,
});

/** The bytes with each code written over them in order, as a copy when anything is written. */
function written(
  buffer: ArrayBuffer,
  codes: readonly number[],
  write: (view: DataView, code: number) => void
) {
  if (codes.length === 0) {
    return buffer;
  }
  const copy = buffer.slice(0);
  const view = new DataView(copy);
  Arr.forEach(codes, (code) => write(view, code));
  return copy;
}

function writeLift(view: DataView, code: number) {
  view.setInt8(Math.floor(code / LIFT_VALUES), (code % LIFT_VALUES) - 128);
}

function writePaint(view: DataView, code: number) {
  view.setUint8(Math.floor(code / PAINT_VALUES), code % PAINT_VALUES);
}

function writeClear(view: DataView, code: number) {
  const point = Math.floor(code / CLEAR_VALUES);
  const byte = Math.floor(point / 8);
  const bit = 2 ** (point % 8);
  const held = view.getUint8(byte);
  const cleared = Math.floor(held / bit) % 2 === 1;
  if (cleared !== (code % CLEAR_VALUES === 1)) {
    view.setUint8(byte, cleared ? held - bit : held + bit);
  }
}

/**
 * One chunk with one operation applied by the rules the server can know
 * without the land (ADR 0050, W4). A refused operation leaves the chunk as it
 * was: a thing whose blueprint the learner has not opened is `locked`, and a
 * thing at a new place of a chunk that holds 192 already is `full`.
 */
export function applyOperation(
  chunk: Chunk,
  operation: Operation,
  blueprints: readonly Thing[]
) {
  return Match.value(operation).pipe(
    Match.tagsExhaustive({
      land: (land) =>
        applied(
          {
            clears: written(chunk.clears, land.clears, writeClear),
            lifts: written(chunk.lifts, land.lifts, writeLift),
            paints: written(chunk.paints, land.paints, writePaint),
            things: chunk.things,
          },
          "done"
        ),
      set: ({ at, kind, turn }) => {
        if (!isOpen(kind, blueprints)) {
          return applied(chunk, "locked");
        }
        const others = Arr.filter(chunk.things, (thing) => thing.at !== at);
        return others.length >= MAX_THINGS
          ? applied(chunk, "full")
          : applied(
              { ...chunk, things: Arr.append(others, { at, kind, turn }) },
              "done"
            );
      },
      take: ({ at }) =>
        applied(
          {
            ...chunk,
            things: Arr.filter(chunk.things, (thing) => thing.at !== at),
          },
          "done"
        ),
    })
  );
}

/**
 * A world's changed chunks, by `chunkKeyOf`, with a batch of operations
 * applied in order (ADR 0050, W4): each operation meets what the ones before
 * it left, so the last write to a point or a place wins, and a refused one
 * changes nothing while the others still apply. A chunk left with no change is
 * dropped, a chunk first changed is added unless the world already counts
 * 4,096, and the count follows both. Answers the chunks, the count, and one
 * outcome for each operation in the order given.
 */
export function settle(
  stored: HashMap.HashMap<number, Chunk>,
  count: number,
  blueprints: readonly Thing[],
  operations: readonly Operation[]
) {
  return Arr.reduce(
    operations,
    { chunks: stored, count, outcomes: Arr.empty<typeof Outcome.Type>() },
    (world, operation) => {
      const key = chunkKeyOf(operation.cx, operation.cz);
      const held = HashMap.get(world.chunks, key);
      const { chunk, outcome } = applyOperation(
        Option.getOrElse(held, bareChunk),
        operation,
        blueprints
      );
      const refused = (result: typeof Outcome.Type) => ({
        ...world,
        outcomes: Arr.append(world.outcomes, result),
      });
      if (outcome !== "done") {
        return refused(outcome);
      }
      const outcomes = Arr.append(world.outcomes, outcome);
      if (isBare(chunk)) {
        return {
          chunks: HashMap.remove(world.chunks, key),
          count: world.count - (Option.isSome(held) ? 1 : 0),
          outcomes,
        };
      }
      if (Option.isNone(held) && world.count >= MAX_CHUNKS) {
        return refused("full");
      }
      return {
        chunks: HashMap.set(world.chunks, key, chunk),
        count: world.count + (Option.isNone(held) ? 1 : 0),
        outcomes,
      };
    }
  );
}
