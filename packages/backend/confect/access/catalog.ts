import { Kind } from "@repo/backend/confect/access/kind";
import { access } from "@repo/backend/confect/access/kinds";
import { tenancy } from "@repo/backend/confect/tenancy/kinds";
import { Array as Arr, Schema, SchemaGetter } from "effect";

/** Every lane's kinds. A lane joins with one line here and one in `extensions`. */
export const kinds = [...tenancy.kinds, ...access.kinds] as const;

/** Every lane's extensions of another lane's kinds. */
const extensions = [...tenancy.extensions, ...access.extensions] as const;

/** Every declaration and extension; each kind's actions, rules, and changes join from these. */
export const entries = [...kinds, ...extensions] as const;

/** A typed `{ kind, id }` pointer; permission is checked whenever it is read. */
export const ObjectRef = Schema.Union(Arr.map(kinds, (kind) => kind.ref)).pipe(
  Schema.toTaggedUnion("kind")
);

/** Every audited change of every kind. */
export const Change = Schema.Union(
  Arr.flatten(Arr.map(entries, (entry) => entry.changes))
);

/** Actions evaluated on the tenant itself, its own and every extension's. */
export const TenantAction = Kind.actions(entries, "tenant");

/**
 * The caller's tenant capabilities on the wire. A client built before a lane
 * added an action drops the unknown literal instead of failing to decode.
 */
export const TenantCapabilities = Schema.Array(Schema.String).pipe(
  Schema.decodeTo(Schema.Array(TenantAction), {
    decode: SchemaGetter.transform(Arr.filter(Schema.is(TenantAction))),
    encode: SchemaGetter.passthroughSubtype(),
  })
);
