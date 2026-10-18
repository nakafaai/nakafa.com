import { Kind } from "@repo/backend/confect/access/kind";
import { access } from "@repo/backend/confect/access/kinds";
import type { Rule, RuleRole } from "@repo/backend/confect/access/schema";
import { classroom } from "@repo/backend/confect/classroom/kinds";
import { connectors } from "@repo/backend/confect/connectors/kinds";
import { editor } from "@repo/backend/confect/editor/kinds";
import { exam } from "@repo/backend/confect/exams/kinds";
import { sitting } from "@repo/backend/confect/exams/sittings/kinds";
import { integrations } from "@repo/backend/confect/integrations/kinds";
import { operators } from "@repo/backend/confect/operators/kinds";
import { tenancy } from "@repo/backend/confect/tenancy/kinds";
import { Array as Arr, Record, Schema, SchemaGetter, Struct } from "effect";

/** Every lane's kinds. A lane joins with one line here and one in `extensions`. */
export const kinds = [
  ...tenancy.kinds,
  ...access.kinds,
  ...integrations.kinds,
  ...connectors.kinds,
  ...classroom.kinds,
  ...operators.kinds,
  ...editor.kinds,
  ...exam.kinds,
  ...sitting.kinds,
] as const;

/** Every lane's extensions of another lane's kinds. */
const extensions = [
  ...tenancy.extensions,
  ...access.extensions,
  ...integrations.extensions,
  ...connectors.extensions,
  ...classroom.extensions,
  ...operators.extensions,
  ...editor.extensions,
  ...exam.extensions,
  ...sitting.extensions,
] as const;

/** Every declaration and extension; each kind's actions, rules, and changes join from these. */
export const entries = [...kinds, ...extensions] as const;

/** A typed `{ kind, id }` pointer; permission is checked whenever it is read. */
export const ObjectRef = Schema.Union(Arr.map(kinds, (kind) => kind.ref)).pipe(
  Schema.toTaggedUnion("kind")
);

/**
 * Every action of every kind, named as `source.verb`. An entry that declares no
 * action, such as an extension that only adds changes, adds no literal here:
 * Confect cannot compile an empty union into a validator.
 */
export const Action = Schema.Union(
  Arr.map(
    Arr.filter(entries, (entry) => Struct.keys(entry.actions).length > 0),
    (entry) => entry.action
  )
);

/**
 * Whether some rule of the catalog grants `action` through `role`. A rule
 * that grants by relations alone opens no role.
 */
export const opensTo = (action: string, role: typeof RuleRole.Type): boolean =>
  Arr.some(entries, (entry) =>
    Arr.some(
      Record.toEntries<string, Rule>(entry.actions),
      ([name, rule]) =>
        name === action &&
        rule.grantedBy === "roles" &&
        Arr.contains(rule.roles, role)
    )
  );

/** Actions evaluated on the tenant itself, its own and every extension's. */
export const TenantAction = Kind.actions(entries, "tenant");

/** Actions evaluated on one school unit, its own and every extension's. */
const UnitAction = Kind.actions(entries, "unit");

/**
 * The action names of one kind on the wire. A client built before a lane added an
 * action drops the unknown literal instead of failing to decode.
 */
const capabilitiesOf = <Action extends Schema.Codec<string>>(action: Action) =>
  Schema.Array(Schema.String).pipe(
    Schema.decodeTo(Schema.Array(action), {
      decode: SchemaGetter.transform(Arr.filter(Schema.is(action))),
      encode: SchemaGetter.passthroughSubtype(),
    })
  );

/** The caller's tenant capabilities on the wire. */
export const TenantCapabilities = capabilitiesOf(TenantAction);

/** The caller's capabilities on one school unit on the wire. */
export const UnitCapabilities = capabilitiesOf(UnitAction);
