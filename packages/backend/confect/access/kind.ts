import { Id, type TableNames } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Rule } from "@repo/backend/confect/access/schema";
import { Array as Arr, type Record, Schema, Struct } from "effect";

/**
 * What a lane adds to a kind: the `source.verb` actions evaluated on its
 * subjects with their rules, and its audited changes, each a struct whose
 * `type` literal names the event and whose details hold IDs, enums, and
 * reason codes only, with the change types consumers may subscribe to.
 */
const Extension = Schema.Struct({
  actions: Schema.Record(Schema.String, Rule),
  changes: Schema.Array(Schema.declare(Schema.isSchema)),
  published: Schema.Array(Schema.String),
});

/** A kind's own declaration also names the relations a Person can hold to its subjects. */
const Declaration = Extension.mapFields(
  Struct.assign({ relations: Schema.Array(Schema.String) })
);

/** One catalog entry, a declaration or an extension: the kind it rules and its actions as one schema. */
const Entry = Extension.mapFields(
  Struct.assign({
    action: Schema.declare(Schema.isSchema),
    kind: Schema.String,
  })
);

/** Declares one kind once, in its lane: the table its subjects live in and what is decided and recorded about them. */
const make = <
  const K extends string,
  const T extends TableNames,
  const D extends typeof Declaration.Type,
>(
  kind: K,
  table: T,
  declaration: D
) => ({
  ...declaration,
  action: Schema.Literals(Struct.keys(Struct.get(declaration, "actions"))),
  kind,
  ref: Schema.Struct({ id: Id(table), kind: Schema.Literal(kind) }),
  table,
});

/**
 * Adds actions or changes to another lane's kind, ruled by that kind's
 * relations: `grant.manage` is evaluated on the unit a grant covers, so the
 * access lane extends the unit kind.
 */
const extend = <
  const B extends typeof Entry.Type,
  const D extends typeof Extension.Type,
>(
  base: B,
  extension: D
) => ({
  ...extension,
  action: Schema.Literals(Struct.keys(Struct.get(extension, "actions"))),
  kind: Struct.get(base, "kind"),
});

/** A kind's entries: its declaration and every lane's extension of it. */
const of = <
  const E extends readonly (typeof Entry.Type)[],
  K extends E[number]["kind"],
>(
  entries: E,
  kind: K
) =>
  Arr.filter(
    entries,
    (entry): entry is Extract<E[number], Record.ReadonlyRecord<"kind", K>> =>
      entry.kind === kind
  );

/**
 * Every action a kind's declaration and its extensions rule on. The return
 * type spells the per-kind selection, which the compiler cannot infer from
 * the filtered entries.
 */
const actions = <
  const E extends readonly (typeof Entry.Type)[],
  K extends E[number]["kind"],
>(
  entries: E,
  kind: K
): Schema.Union<
  readonly Extract<E[number], Record.ReadonlyRecord<"kind", K>>["action"][]
> => Schema.Union(Arr.map(of(entries, kind), (entry) => entry.action));

/** Every change a kind's declaration and its extensions declare. */
const changes = <
  const E extends readonly (typeof Entry.Type)[],
  K extends E[number]["kind"],
>(
  entries: E,
  kind: K
): Schema.Union<
  readonly Extract<
    E[number],
    Record.ReadonlyRecord<"kind", K>
  >["changes"][number][]
> =>
  Schema.Union(
    Arr.flatten(Arr.map(of(entries, kind), (entry) => entry.changes))
  );

/**
 * The options of an object kind's access spec: `action` is typed from the
 * catalog, so an action of another kind does not compile, and `arg` names
 * the argument holding the subject's ID.
 */
const options = <
  const E extends readonly (typeof Entry.Type)[],
  K extends E[number]["kind"],
>(
  entries: E,
  kind: K
) => Schema.Struct({ action: actions(entries, kind), arg: Schema.String });

/**
 * The client-safe half of every access spec: it refuses with `AccessDenied`,
 * runs in queries and mutations (the first lane that attaches one to a Convex
 * action turns `action` on here), and builds its options on first use.
 */
const spec = <S extends Schema.Top>(options: () => S) => ({
  error: () => AccessDenied,
  functionTypes: { action: false, mutation: true, query: true } as const,
  options,
});

/** The client-safe half of an object kind's access spec. */
const middleware = <
  const E extends readonly (typeof Entry.Type)[],
  K extends E[number]["kind"],
>(
  entries: E,
  kind: K
) => spec(() => options(entries, kind));

/** Declares access kinds once per lane and derives each kind's schemas from every lane's entries. */
export const Kind = {
  actions,
  changes,
  extend,
  make,
  middleware,
  of,
  options,
  spec,
};
