import { ItemFromCode, materialsOf } from "@repo/backend/confect/island/item";
import { MAX_SIZE } from "@repo/backend/confect/island/level";
import {
  addMaterials,
  NO_MATERIALS,
} from "@repo/backend/confect/island/material";
import {
  Array as Arr,
  Effect,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from "effect";

/** The highest layer a placement may stand on, counted from the ground. */
export const MAX_HEIGHT = 8;

/** The bytes of one stored placement (ADR 0042, D4). */
const RECORD_BYTES = 10;

/** The turn byte holds the rotation in its lowest two bits and the stage above them. */
const TURNS = 4;

const Coordinate = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: MAX_SIZE - 1 })
);
const Word = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 65_535 })
);

/**
 * One item standing on an island: where it stands, which way it faces, its
 * upgrade stage, the Stars it paid (refunded when it is removed), and the days
 * a plant was watered.
 */
export const Placement = Schema.Struct({
  item: ItemFromCode,
  x: Coordinate,
  y: Coordinate,
  z: Schema.Int.check(
    Schema.isBetween({ minimum: 0, maximum: MAX_HEIGHT - 1 })
  ),
  /** Quarter turns clockwise from the island's north. */
  rotation: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 })),
  stage: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 })),
  paid: Word,
  growth: Word,
});
export type Placement = typeof Placement.Type;

type PlacementRecord = typeof Placement.Encoded;

/** Reads the records of a packed layout; its length is checked first. */
function readRecords(view: DataView) {
  return Arr.makeBy(view.byteLength / RECORD_BYTES, (index) => {
    const at = index * RECORD_BYTES;
    const turn = view.getUint8(at + 5);
    return {
      item: view.getUint16(at, true),
      x: view.getUint8(at + 2),
      y: view.getUint8(at + 3),
      z: view.getUint8(at + 4),
      rotation: turn % TURNS,
      stage: Math.floor(turn / TURNS),
      paid: view.getUint16(at + 6, true),
      growth: view.getUint16(at + 8, true),
    };
  });
}

/** Packs records whose every field the Placement schema has already checked. */
function writeRecords(records: readonly PlacementRecord[]) {
  const buffer = new ArrayBuffer(records.length * RECORD_BYTES);
  const view = new DataView(buffer);
  Arr.forEach(records, (record, index) => {
    const at = index * RECORD_BYTES;
    view.setUint16(at, record.item, true);
    view.setUint8(at + 2, record.x);
    view.setUint8(at + 3, record.y);
    view.setUint8(at + 4, record.z);
    view.setUint8(at + 5, record.rotation + record.stage * TURNS);
    view.setUint16(at + 6, record.paid, true);
    view.setUint16(at + 8, record.growth, true);
  });
  return buffer;
}

/**
 * An island's placements, stored and sent as one packed `ArrayBuffer` and read
 * as a list in code, on the server and in the browser alike. A buffer whose
 * length is not a whole number of records, or a record that breaks the
 * Placement schema, is refused.
 */
export const Layout = Schema.instanceOf(ArrayBuffer).pipe(
  Schema.decodeTo(
    Schema.Array(Placement),
    SchemaTransformation.transformEffect<
      readonly PlacementRecord[],
      ArrayBuffer
    >({
      decode: (buffer, options) =>
        buffer.byteLength % RECORD_BYTES === 0
          ? Effect.succeed(readRecords(new DataView(buffer)))
          : Effect.fail(
              new SchemaIssue.InvalidValue(
                { message: "An island layout holds whole records only." },
                buffer.byteLength,
                options
              )
            ),
      encode: (records) => Effect.succeed(writeRecords(records)),
    })
  )
);

/** The Stars the placements of a layout paid, which removing them would return. */
export function paidFor(layout: readonly Placement[]) {
  return Arr.reduce(layout, 0, (total, placement) => total + placement.paid);
}

/** The materials the stages of a layout cost, which removing them would return. */
export function materialsFor(layout: readonly Placement[]) {
  return Arr.reduce(layout, NO_MATERIALS, (total, placement) =>
    addMaterials(total, materialsOf(placement.item, placement.stage))
  );
}

/** The layout with the placement at one index changed. */
export function replaceAt(
  layout: readonly Placement[],
  index: number,
  placement: Placement
) {
  return Arr.map(layout, (current, at) => (at === index ? placement : current));
}
