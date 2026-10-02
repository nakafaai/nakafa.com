import type { GenericId } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { actionsOf } from "@repo/backend/confect/access/kind";
import { access } from "@repo/backend/confect/access/kinds";
import { tenancy } from "@repo/backend/confect/tenancy/kinds";
import { Schema, SchemaTransformation } from "effect";

/** Every lane's kind declarations. A lane joins with one line. */
const lanes = [tenancy, access] as const;
type Lane = (typeof lanes)[number];
type Kinds = Lane["kinds"][number];
type Entries = Kinds | Lane["extensions"][number];

// Each callback names its element union: inferred from the first lane alone,
// `flatMap` would reject every other lane's declarations.
export const kinds = lanes.flatMap((lane): readonly Kinds[] => lane.kinds);
export const extensions = lanes.flatMap(
  (lane): readonly Lane["extensions"][number][] => lane.extensions
);
/** What kind middleware options and the server registry are derived from. */
export const catalog = { extensions, kinds } as const;
type DeclarationOf<K extends ResourceKind> = Extract<
  Kinds,
  { readonly name: K }
>;
type EntriesOf<K extends ResourceKind> = Extract<Entries, { readonly name: K }>;

export type ResourceKind = Kinds["name"];
/** Kinds whose subject a function names through an ID argument. */
export type ObjectKind = Extract<Kinds, { readonly scope: "object" }>["name"];
export type TableOf<K extends ResourceKind> = DeclarationOf<K>["table"];
export type SubjectOf<K extends ResourceKind> = Docs[TableOf<K>];
export type IdOf<K extends ResourceKind> = GenericId.GenericId<TableOf<K>>;
export type RelationOf<K extends ResourceKind> =
  DeclarationOf<K>["relations"][number];
/** Actions evaluated on subjects of kind `K`, its own and every extension's. */
export type ActionOf<K extends ResourceKind> =
  EntriesOf<K>["actionSchema"]["Type"];
/** Changes a journal entry may record about a subject of kind `K`. */
export type ChangeOf<K extends ResourceKind> =
  EntriesOf<K>["changes"][number]["Type"];

/** A typed `{ kind, id }` pointer; permission is checked whenever it is read. */
export const ObjectRef = Schema.Union(kinds.map((kind) => kind.ref));
export type ObjectRef = typeof ObjectRef.Type;

/** Every audited change of every kind. */
export const Change = Schema.Union(
  [...kinds, ...extensions].flatMap(
    (entry): readonly Entries["changes"][number][] => entry.changes
  )
);
export type Change = typeof Change.Type;

/** Change types journal consumers (notifications, webhooks, exports) may subscribe to. */
export const Published = Schema.Literals(
  [...kinds, ...extensions].flatMap(
    (entry): readonly Entries["published"][number][] => entry.published
  )
);

export const TenantAction = actionsOf(catalog, "tenant");
export type TenantAction = typeof TenantAction.Type;

/**
 * The caller's tenant capabilities on the wire. A client built before a lane
 * added an action drops the unknown literal instead of failing to decode.
 */
export const TenantCapabilities = Schema.Array(Schema.String).pipe(
  Schema.decodeTo(
    Schema.Array(TenantAction),
    SchemaTransformation.transform({
      decode: (actions: readonly string[]): readonly TenantAction[] =>
        actions.filter(Schema.is(TenantAction)),
      encode: (actions: readonly TenantAction[]): readonly string[] => actions,
    })
  )
);
