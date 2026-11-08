import {
  Array as Arr,
  Effect,
  Record,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from "effect";

/**
 * How an item stands: a block fills one cell and carries what is put on it, a
 * piece covers its footprint and takes the space above it, and a pond sinks
 * into the ground and takes the space above it too.
 */
const Kind = Schema.Literals(["block", "piece", "pond"]);

/** One entry of the catalog. */
const Entry = Schema.Struct({
  code: Schema.Int,
  footprint: Schema.Tuple([Schema.Int, Schema.Int]),
  kind: Kind,
  /** Each stage's price in Stars and the level that opens it. */
  stages: Schema.Array(Schema.Struct({ level: Schema.Int, price: Schema.Int })),
});

/**
 * Every item an island can hold (ADR 0042, D10, D12): the code a stored layout
 * writes for it, the cells it covers east by south before it turns, how it
 * stands, and its stages with the Stars each costs and what opens it. A code
 * lives in every saved island, so it never changes and is never given to
 * another item. A stage's footprint is its item's, so an upgrade never moves.
 */
const ITEMS = {
  house: {
    code: 1,
    footprint: [2, 2],
    kind: "piece",
    stages: [
      { level: 1, price: 60 },
      { level: 2, price: 150 },
      { level: 4, price: 400 },
      { level: 6, price: 900 },
    ],
  },
  tree: {
    code: 2,
    footprint: [1, 1],
    kind: "piece",
    stages: [
      { level: 1, price: 5 },
      { level: 1, price: 12 },
      { level: 1, price: 30 },
      { level: 3, price: 60 },
    ],
  },
  pond: {
    code: 3,
    footprint: [3, 3],
    kind: "pond",
    stages: [
      { level: 2, price: 40 },
      { level: 2, price: 60 },
      { level: 2, price: 120 },
      { level: 5, price: 400 },
    ],
  },
  grass: {
    code: 10,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 1, price: 2 }],
  },
  soil: {
    code: 11,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 1, price: 2 }],
  },
  stone: {
    code: 12,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 3, price: 3 }],
  },
  sand: {
    code: 13,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 2, price: 3 }],
  },
  planks: {
    code: 14,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 1, price: 4 }],
  },
  brick: {
    code: 15,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 3, price: 6 }],
  },
  glass: {
    code: 16,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 3, price: 6 }],
  },
  tile: {
    code: 17,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 4, price: 8 }],
  },
  slate: {
    code: 18,
    footprint: [1, 1],
    kind: "block",
    stages: [{ level: 4, price: 8 }],
  },
  flowers: {
    code: 30,
    footprint: [1, 1],
    kind: "piece",
    stages: [{ level: 1, price: 3 }],
  },
  bush: {
    code: 31,
    footprint: [1, 1],
    kind: "piece",
    stages: [{ level: 1, price: 4 }],
  },
  rock: {
    code: 32,
    footprint: [1, 1],
    kind: "piece",
    stages: [{ level: 2, price: 5 }],
  },
  lamp: {
    code: 33,
    footprint: [1, 1],
    kind: "piece",
    stages: [{ level: 4, price: 10 }],
  },
} satisfies Record<string, typeof Entry.Type>;

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

/** How an item stands: a block, a piece, or a pond. */
export function kindOf(item: Item) {
  return ITEMS[item].kind;
}

/** An item's stages in order, with the Stars each costs and what opens it. */
export function stagesOf(
  item: Item
): readonly (typeof Entry.Type)["stages"][number][] {
  return ITEMS[item].stages;
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
