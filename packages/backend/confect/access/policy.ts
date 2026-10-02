import type { GenericId, MiddlewareSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type ActionOf,
  catalog,
  type IdOf,
  type ObjectKind,
  type ObjectRef,
  type RelationOf,
  type ResourceKind,
  type SubjectOf,
  type TableOf,
} from "@repo/backend/confect/access/catalog";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { actionsOf, type Rule } from "@repo/backend/confect/access/kind";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  type Context,
  Effect,
  Option,
  Predicate,
  Record,
  Schema,
} from "effect";

/** Active grants one Person may hold; the principal read takes one more to stay bounded. */
export const GRANT_LIMIT = 32;

/** One Person's active grants, bounded by the per-Person limit plus one. */
export const activeGrants = Effect.fn("access.grants.active")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantGrants")
    .index("by_personId_and_status", (query) =>
      query.eq("personId", personId).eq("status", "active")
    )
    .take(GRANT_LIMIT + 1)
    .pipe(Effect.orDie);
});

/** Where a subject sits and whether its state refuses writes. */
export interface Placement {
  /** The subject or its container is ended, archived, or closed. */
  readonly locked: boolean;
  /** Units whose grants cover the subject; empty for tenant-level subjects. */
  readonly units: readonly GenericId.GenericId<"tenantUnits">[];
}

/** `role` and `condition` name why access was refused. */
export type Decision = "allow" | "role" | "condition";

type MemberOf = Member["Service"];
type RelationCheck<Row> = (
  row: Row,
  member: MemberOf
) => Effect.Effect<boolean, never, DatabaseReader>;

/** How one kind's subjects are loaded, placed, and related to the caller. */
export interface Authority<K extends ResourceKind> {
  /** Every action evaluated on this kind's subjects. */
  readonly actions: Schema.Schema<ActionOf<K>>;
  readonly id: Schema.Codec<IdOf<K>, IdOf<K>>;
  readonly kind: K;
  /** A missing document is `None`, never an error. */
  readonly load: (
    id: IdOf<K>
  ) => Effect.Effect<Option.Option<SubjectOf<K>>, never, DatabaseReader>;
  /** At most one indexed read. */
  readonly place: (
    row: SubjectOf<K>
  ) => Effect.Effect<Placement, never, DatabaseReader>;
  /** The `{ kind, id }` reference journal entries and links store. */
  readonly ref: (row: SubjectOf<K>) => ObjectRef;
  readonly relations: readonly (readonly [
    string,
    RelationCheck<SubjectOf<K>>,
  ])[];
  readonly rules: ReadonlyMap<string, Rule>;
  readonly tenantOf: (row: SubjectOf<K>) => GenericId.GenericId<"tenants">;
}

/** A tenant-scoped grant covers everything; a unit grant covers its unit's subjects. */
const covers = (
  scope: GrantScope,
  units: readonly GenericId.GenericId<"tenantUnits">[]
) => scope.kind === "tenant" || units.includes(scope.unitId);

/**
 * Conditions come first, so no role or relation overrides a suspended tenant
 * or a locked subject. Relations decide only what roles leave open, so their
 * checks, the only reads a decision may make, run last. No rule reads the
 * clock.
 */
export const decide = Effect.fn("access.decide")(function* (
  rule: Rule,
  placement: Placement,
  member: MemberOf,
  related: (
    relations: readonly string[]
  ) => Effect.Effect<boolean, never, DatabaseReader>
): Effect.fn.Return<Decision, never, DatabaseReader> {
  if (
    rule.access === "write" &&
    (member.tenant.status === "suspended" || placement.locked)
  ) {
    return "condition";
  }
  if (
    rule.grantedBy === "roles" &&
    member.grants.some(
      (grant) =>
        covers(grant.scope, placement.units) &&
        (grant.role.key === "owner" ||
          rule.roles.some((role) => role === grant.role.key))
    )
  ) {
    return "allow";
  }
  return (yield* related(rule.relations)) ? "allow" : "role";
});

/** The relations between the caller and one subject, each checked at most once. */
const relationsOf = Effect.fnUntraced(function* <K extends ResourceKind>(
  authority: Authority<K>,
  row: SubjectOf<K>,
  member: MemberOf
) {
  const checks = yield* Effect.forEach(authority.relations, ([name, check]) =>
    Effect.map(Effect.cached(check(row, member)), (holds) => ({
      holds,
      name,
    }))
  );
  return (relations: readonly string[]) =>
    Effect.findFirst(
      checks.filter((check) => relations.includes(check.name)),
      (check) => check.holds
    ).pipe(Effect.map(Option.isSome));
});

const denied = (action: string, reason: AccessDenied["reason"]) =>
  new AccessDenied({
    action,
    code: "ACCESS_DENIED",
    message: "You do not have access to this.",
    reason,
  });

/** Decides one action on a loaded subject of the member's tenant. */
export const checkRow = Effect.fn("access.checkRow")(function* <
  K extends ResourceKind,
>(
  authority: Authority<K>,
  action: ActionOf<K>,
  row: SubjectOf<K>,
  member: MemberOf
): Effect.fn.Return<void, AccessDenied, DatabaseReader> {
  const rule = authority.rules.get(action);
  if (rule === undefined) {
    return yield* Effect.die(
      `Access action ${action} has no rule on kind ${authority.kind}.`
    );
  }
  const decision = yield* decide(
    rule,
    yield* authority.place(row),
    member,
    yield* relationsOf(authority, row, member)
  );
  if (decision !== "allow") {
    return yield* denied(action, decision);
  }
});

/**
 * Loads a subject, derives its tenant from the data, then decides. A missing
 * object and another tenant's object get the same denial.
 */
export const checkId = Effect.fn("access.checkId")(function* <
  K extends ResourceKind,
>(
  authority: Authority<K>,
  action: ActionOf<K>,
  id: IdOf<K>,
  member: MemberOf
): Effect.fn.Return<SubjectOf<K>, AccessDenied, DatabaseReader> {
  const row = yield* authority.load(id);
  if (
    Option.isNone(row) ||
    authority.tenantOf(row.value) !== member.tenant._id
  ) {
    yield* Effect.logWarning("Access denied for an unknown subject.").pipe(
      Effect.annotateLogs({ action, kind: authority.kind })
    );
    return yield* denied(action, "resource");
  }
  yield* checkRow(authority, action, row.value, member);
  return row.value;
});

/** The actions of one kind the caller may perform on a loaded subject. */
export const allowedOn = Effect.fn("access.allowedOn")(function* <
  K extends ResourceKind,
>(
  authority: Authority<K>,
  row: SubjectOf<K>,
  member: MemberOf
): Effect.fn.Return<readonly ActionOf<K>[], never, DatabaseReader> {
  const placement = yield* authority.place(row);
  const related = yield* relationsOf(authority, row, member);
  const decisions = yield* Effect.forEach(authority.rules, ([action, rule]) =>
    Effect.map(decide(rule, placement, member, related), (decision) =>
      decision === "allow" ? [action] : []
    )
  );
  return decisions.flat().filter(Schema.is(authority.actions));
});

/**
 * Implements one declared kind: how its tenant is derived from a row, where
 * the row sits, and every declared relation (no more, no less). Rules come
 * from the catalog, its own and every extension's.
 */
const make = <K extends ResourceKind>(
  declaration: { readonly name: K; readonly table: TableOf<K> },
  implementation: {
    readonly place: (
      row: SubjectOf<K>
    ) => Effect.Effect<Placement, never, DatabaseReader>;
    readonly relations: {
      readonly [R in RelationOf<K>]: RelationCheck<SubjectOf<K>>;
    };
    readonly tenantOf: (row: SubjectOf<K>) => GenericId.GenericId<"tenants">;
  }
) => {
  // Annotated locals keep the kind's own types: read bare, a value of a
  // generic union-constrained type is widened to the whole constraint.
  const kind: K = declaration.name;
  const table: TableOf<K> = declaration.table;
  return {
    actions: actionsOf<typeof catalog, K>(catalog, kind),
    id: Id<TableOf<K>>(table),
    kind,
    load: (id: IdOf<K>) =>
      DatabaseReader.pipe(
        Effect.flatMap((reader) => reader.table(table).get(id)),
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.orDie
      ),
    place: implementation.place,
    ref: (row: SubjectOf<K>) => {
      const id: SubjectOf<K>["_id"] = row._id;
      return { id, kind };
    },
    relations: Record.toEntries(implementation.relations),
    rules: new Map(
      [...catalog.kinds, ...catalog.extensions]
        .filter((entry) => entry.name === kind)
        .flatMap((entry) => Object.entries<Rule>(entry.actions))
    ),
    tenantOf: implementation.tenantOf,
  };
};

/**
 * The strategy of an object kind's access middleware: decode the subject's
 * ID from the `arg` argument, check the action on it, and provide the row as
 * the kind's subject service. A second attachment of the same kind spec would
 * shadow the first subject, so it dies; check further objects of the kind in
 * the handler with `authorize`.
 */
const middleware = <K extends ObjectKind, I>(
  subject: Context.Key<I, SubjectOf<K>>,
  authority: Authority<K>
) =>
  Effect.fn("access.middleware")(function* <E>(
    effect: Effect.Effect<MiddlewareSpec.SuccessValue, E, I>,
    {
      invocation,
      options,
    }: {
      readonly invocation: { readonly args: unknown };
      readonly options: { readonly action: ActionOf<K>; readonly arg: string };
    }
  ): Effect.fn.Return<
    MiddlewareSpec.SuccessValue,
    E | AccessDenied,
    DatabaseReader | Member
  > {
    if (Option.isSome(yield* Effect.serviceOption(subject))) {
      return yield* Effect.die(
        `The ${authority.kind} access middleware is attached twice; check further ${authority.kind} objects with authorize.`
      );
    }
    const id = yield* Schema.decodeUnknownEffect(authority.id)(
      Predicate.hasProperty(invocation.args, options.arg)
        ? invocation.args[options.arg]
        : undefined
    ).pipe(Effect.orDie);
    const row = yield* checkId(authority, options.action, id, yield* Member);
    return yield* effect.pipe(Effect.provideService(subject, row));
  });

/** The strategy of the tenant access middleware: the member's tenant is the subject. */
const root = (authority: Authority<"tenant">) =>
  Effect.fn("access.tenant")(function* <E, R>(
    effect: Effect.Effect<MiddlewareSpec.SuccessValue, E, R>,
    { options }: { readonly options: { readonly action: ActionOf<"tenant"> } }
  ): Effect.fn.Return<
    MiddlewareSpec.SuccessValue,
    E | AccessDenied,
    R | DatabaseReader | Member
  > {
    const member = yield* Member;
    yield* checkRow(authority, options.action, member.tenant, member);
    return yield* effect;
  });

/** Constructors a lane uses to implement its kinds. */
export const Authority = { make, middleware, root } as const;
