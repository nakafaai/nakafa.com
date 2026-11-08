import {
  Array as Arr,
  Effect,
  Record,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from "effect";

/**
 * Every item an island can hold: the code a stored layout writes for it, and
 * the cells it covers, east by south, before it turns. A code lives in every
 * saved island, so it never changes and is never given to another item.
 */
const ITEMS = {
  house: { code: 1, footprint: [2, 2] },
  tree: { code: 2, footprint: [1, 1] },
  pond: { code: 3, footprint: [3, 3] },
} as const;

/** Every item an island can hold. */
export const Item = Schema.Literals(Record.keys(ITEMS));
export type Item = typeof Item.Type;

const ITEMS_BY_CODE = Record.fromEntries(
  Arr.map(Record.toEntries(ITEMS), ([item, entry]) => [
    String(entry.code),
    item,
  ])
);

/** The cells an item covers, east by south, after `rotation` quarter turns. */
export function footprintOf(item: Item, rotation: number) {
  const [east, south] = ITEMS[item].footprint;
  return rotation % 2 === 0
    ? ([east, south] as const)
    : ([south, east] as const);
}

/**
 * An item as a layout record stores it: its code on the wire and in the table,
 * its name in code. An unknown code is refused, so a layout never decodes to an
 * item this build cannot draw.
 */
export const ItemFromCode = Schema.Int.pipe(
  Schema.decodeTo(
    Item,
    SchemaTransformation.transformEffect({
      decode: (code, options) =>
        Effect.fromOption(Record.get(ITEMS_BY_CODE, String(code))).pipe(
          Effect.mapError(
            () =>
              new SchemaIssue.InvalidValue(
                { message: "Unknown island item." },
                code,
                options
              )
          )
        ),
      encode: (item) => Effect.succeed(ITEMS[item].code),
    })
  )
);
