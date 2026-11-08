import {
  Array as Arr,
  Effect,
  Record,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from "effect";

/**
 * The code a stored layout writes for each item. A code lives in every saved
 * island, so it never changes and is never given to another item.
 */
const ITEM_CODES = {
  house: 1,
  tree: 2,
} as const;

/** Every item an island can hold. */
export const Item = Schema.Literals(Record.keys(ITEM_CODES));
export type Item = typeof Item.Type;

const ITEMS_BY_CODE = Record.fromEntries(
  Arr.map(Record.toEntries(ITEM_CODES), ([item, code]) => [String(code), item])
);

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
      encode: (item) => Effect.succeed(ITEM_CODES[item]),
    })
  )
);
