import { Id, type TableNames } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Schema, Struct } from "effect";

/** Action literals read `source.verb`; the source names the object the action concerns. */
export type ActionName = `${string}.${string}`;

/**
 * How one action is granted. A `roles` rule allows its roles, every Owner,
 * and its relations. A `relations` rule allows its relations only: no role,
 * not even Owner, may record a guardian's consent or answer a student's exam.
 */
export type Rule<Relation extends string = string> =
  | {
      readonly access: "read" | "write";
      readonly grantedBy: "roles";
      readonly relations: readonly Relation[];
      readonly roles: readonly Exclude<BuiltinRole, "owner">[];
    }
  | {
      readonly access: "read" | "write";
      readonly grantedBy: "relations";
      readonly relations: readonly [Relation, ...Relation[]];
    };

/**
 * An audited change of one kind: `type` names the event, and details hold
 * IDs, enums, and reason codes only, so an entry never outlives personal data.
 */
export type ChangeSchema = Schema.ConstraintCodec<
  { readonly type: ActionName },
  { readonly type: string }
>;

interface Rules<Relation extends string> {
  readonly [action: ActionName]: Rule<Relation>;
}
type ChangeType<Changes extends readonly ChangeSchema[]> =
  Changes[number]["Type"]["type"];

/** What every declaration and extension adds to the catalog for one kind. */
interface Entry {
  readonly actionSchema: Schema.Constraint;
  readonly actions: Rules<string>;
  readonly changes: readonly ChangeSchema[];
  readonly name: string;
  readonly published: readonly string[];
}

/** The declarations of every lane: what middleware options and the registry read. */
export interface Catalog {
  readonly extensions: readonly Entry[];
  readonly kinds: readonly (Entry & {
    readonly relations: readonly string[];
    readonly scope: "root" | "object";
  })[];
}

/**
 * Declares one kind: its table, its relations, the actions evaluated on its
 * subjects with their rules, and its audited changes. `root` is the tenant
 * itself; `object` kinds are named by a function argument.
 */
const declare =
  <const Scope extends "root" | "object">(scope: Scope) =>
  <
    const Name extends string,
    const Table extends TableNames,
    const Relation extends string,
    const Actions extends Rules<Relation>,
    const Changes extends readonly ChangeSchema[],
  >(declaration: {
    readonly actions: Actions;
    readonly changes: Changes;
    readonly name: Name;
    readonly published: readonly NoInfer<ChangeType<Changes>>[];
    readonly relations: readonly Relation[];
    readonly table: Table;
  }) => ({
    ...declaration,
    actionSchema: Schema.Literals(Struct.keys(declaration.actions)),
    ref: Schema.Struct({
      id: Id(declaration.table),
      kind: Schema.Literal(declaration.name),
    }),
    scope,
  });

/**
 * Adds actions or changes to another lane's kind, ruled with that kind's
 * relations: `cohort.create` is evaluated on the parent unit, so the people
 * lane extends the unit kind.
 */
const extend = <
  const Base extends {
    readonly name: string;
    readonly relations: readonly string[];
  },
  const Actions extends Rules<Base["relations"][number]>,
  const Changes extends readonly ChangeSchema[],
>(
  base: Base,
  extension: {
    readonly actions: Actions;
    readonly changes: Changes;
    readonly published: readonly NoInfer<ChangeType<Changes>>[];
  }
) => {
  // Read bare, a value of a generic type with a string constraint widens to
  // `string`; the annotation keeps the extended kind's literal name.
  const name: Base["name"] = base.name;
  return {
    ...extension,
    actionSchema: Schema.Literals(Struct.keys(extension.actions)),
    name,
  };
};

type EntryOf<C extends Catalog> = C["kinds"][number] | C["extensions"][number];
type NameOf<C extends Catalog, Scope extends "root" | "object"> = Extract<
  C["kinds"][number],
  { readonly scope: Scope }
>["name"];

const named =
  <K extends string>(name: K) =>
  <E extends { readonly name: string }>(
    entry: E
  ): entry is Extract<E, { readonly name: K }> =>
    entry.name === name;

type ActionsSchema<C extends Catalog, K extends string> = Schema.Union<
  Extract<EntryOf<C>, { readonly name: K }>["actionSchema"][]
>;

/** Every action a kind's declaration and its extensions rule on, as one literal schema. */
export const actionsOf = <C extends Catalog, K extends string>(
  catalog: C,
  name: K
): ActionsSchema<C, K> =>
  Schema.Union(
    [...catalog.kinds, ...catalog.extensions]
      .filter(named(name))
      .map((entry) => entry.actionSchema)
  );

/** The client-safe half of a kind's access middleware spec. */
interface AccessSpec<Options extends Schema.Top> {
  readonly error: () => typeof AccessDenied;
  readonly functionTypes: {
    readonly action: false;
    readonly mutation: true;
    readonly query: true;
  };
  readonly options: () => Options;
}

/**
 * Options for a kind's access middleware, typed from the catalog: the root
 * kind takes `{ action }`, an object kind `{ action, arg }`, where `arg` names
 * the argument holding the subject's ID. An action of another kind does not
 * compile.
 */
function middleware<C extends Catalog, K extends NameOf<C, "root">>(
  catalog: C,
  name: K
): AccessSpec<Schema.Struct<{ readonly action: ActionsSchema<C, K> }>>;
function middleware<C extends Catalog, K extends NameOf<C, "object">>(
  catalog: C,
  name: K
): AccessSpec<
  Schema.Struct<{
    readonly action: ActionsSchema<C, K>;
    readonly arg: Schema.String;
  }>
>;
function middleware(catalog: Catalog, name: string) {
  const action = actionsOf(catalog, name);
  const root = catalog.kinds.some(
    (kind) => kind.name === name && kind.scope === "root"
  );
  return {
    error: () => AccessDenied,
    functionTypes: { action: false, mutation: true, query: true },
    options: () =>
      root
        ? Schema.Struct({ action })
        : Schema.Struct({ action, arg: Schema.String }),
  } as const;
}

/** Declaration constructors for access kinds; each lane declares its kinds once. */
export const Kind = {
  extend,
  middleware,
  object: declare("object"),
  root: declare("root"),
} as const;
