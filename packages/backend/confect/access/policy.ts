import type { GenericId, MiddlewareSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  entries,
  type kinds,
  ObjectRef,
} from "@repo/backend/confect/access/catalog";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Kind } from "@repo/backend/confect/access/kind";
import { GrantScope, Rule } from "@repo/backend/confect/access/schema";
import type { Actor } from "@repo/backend/confect/journal/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  Array as Arr,
  type Context,
  Effect,
  HashMap,
  Option,
  Predicate,
  Record,
  Schema,
  Struct,
  Tuple,
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
export const Placement = Schema.Struct({
  /** The subject or its container is ended, archived, or closed. */
  locked: Schema.Boolean,
  /** Units whose grants cover the subject; empty for tenant-level subjects. */
  units: Schema.Array(Id("tenantUnits")),
});

/** One action on one subject: allowed, or refused by role or by condition. */
export const Decision = Schema.Literals(["allow", "role", "condition"]);

/**
 * Conditions come first, so no role or relation overrides a suspended tenant
 * or a locked subject. Relations decide only what roles leave open, so their
 * checks, the only reads a decision may make, run last. No rule reads the
 * clock.
 */
export const decide = Effect.fn("access.decide")(function* (
  rule: Rule,
  placement: typeof Placement.Type,
  member: Member["Service"],
  relations: HashMap.HashMap<
    string,
    Effect.Effect<boolean, never, DatabaseReader>
  >
): Effect.fn.Return<typeof Decision.Type, never, DatabaseReader> {
  if (
    rule.access === "write" &&
    (member.tenant.status === "suspended" || placement.locked)
  ) {
    return "condition";
  }
  const byRole = Rule.match(rule, {
    relations: () => false,
    roles: ({ roles }) =>
      Arr.some(
        member.grants,
        (grant) =>
          GrantScope.match(grant.scope, {
            tenant: () => true,
            unit: ({ unitId }) => Arr.contains(placement.units, unitId),
          }) &&
          (grant.role.key === "owner" ||
            Arr.some(roles, (role) => role === grant.role.key))
      ),
  });
  if (byRole) {
    return "allow";
  }
  const related = yield* Effect.findFirst(rule.relations, (relation) =>
    Option.getOrElse(HashMap.get(relations, relation), () =>
      Effect.die(`Access rules name an undeclared relation ${relation}.`)
    )
  );
  return Option.isSome(related) ? "allow" : "role";
});

/** Loads one subject of a kind by ID; a missing document is `None`, never an error. */
const load = <const K extends (typeof kinds)[number]>(kind: K) =>
  Effect.fn("access.load")(function* (id: GenericId.GenericId<K["table"]>) {
    return yield* (yield* DatabaseReader)
      .table(Struct.get(kind, "table"))
      .get(id)
      .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  });

/**
 * Implements one declared kind: which tenant a loaded row belongs to, where
 * it sits (at most one indexed read), and exactly its declared relations,
 * each checked at most once per subject. Rules come from the catalog, the
 * kind's own and every extension's. The implementation is a record of
 * callbacks, so its type lists their signatures.
 */
const make = <
  const K extends (typeof kinds)[number],
  Row extends Record.ReadonlyRecord<"_id", GenericId.GenericId<K["table"]>>,
>(
  kind: K,
  loadRow: (
    id: GenericId.GenericId<K["table"]>
  ) => Effect.Effect<Option.Option<Row>, never, DatabaseReader>,
  implementation: {
    place: (
      row: Row
    ) => Effect.Effect<typeof Placement.Type, never, DatabaseReader>;
    relations: Record.ReadonlyRecord<
      K["relations"][number],
      (
        row: Row,
        member: Member["Service"]
      ) => Effect.Effect<boolean, never, DatabaseReader>
    >;
    tenantOf: (row: Row) => GenericId.GenericId<"tenants">;
  }
) => {
  const name = Struct.get(kind, "kind");
  const Action = Kind.actions(entries, name);
  const Change = Kind.changes(entries, name);
  const Options = Kind.options(entries, name);
  const SubjectId = Id(Struct.get(kind, "table"));
  const rules = HashMap.fromIterable(
    Arr.flatMap(Kind.of(entries, name), (entry) =>
      Record.toEntries<string, Rule>(entry.actions)
    )
  );

  const relationsOf = Effect.fnUntraced(function* (
    row: Row,
    member: Member["Service"]
  ) {
    return HashMap.fromIterable(
      yield* Effect.forEach(
        Record.toEntries(implementation.relations),
        ([relation, holds]) =>
          Effect.map(Effect.cached(holds(row, member)), (cached) =>
            Tuple.make<[string, Effect.Effect<boolean, never, DatabaseReader>]>(
              relation,
              cached
            )
          )
      )
    );
  });

  /** Decides one action on a loaded subject of the member's tenant. */
  const check = Effect.fn("access.check")(function* (
    action: typeof Action.Type,
    row: Row
  ) {
    const member = yield* Member;
    const rule = yield* Option.match(HashMap.get(rules, action), {
      onNone: () =>
        Effect.die(`Access action ${action} has no rule on kind ${name}.`),
      onSome: Effect.succeed,
    });
    const decision = yield* decide(
      rule,
      yield* implementation.place(row),
      member,
      yield* relationsOf(row, member)
    );
    if (decision !== "allow") {
      return yield* new AccessDenied({ action, reason: decision });
    }
  });

  /**
   * Loads a subject, derives its tenant from its data, then decides. A
   * missing object and another tenant's object get the same denial.
   */
  const authorize = Effect.fn("access.authorize")(function* (
    action: typeof Action.Type,
    id: GenericId.GenericId<K["table"]>
  ) {
    const member = yield* Member;
    const row = yield* loadRow(id).pipe(
      Effect.map(
        Option.filter(
          (loaded) => implementation.tenantOf(loaded) === member.tenant._id
        )
      ),
      Effect.flatMap(Effect.fromOption),
      Effect.mapError(() => new AccessDenied({ action, reason: "resource" })),
      Effect.tapError(() =>
        Effect.logWarning("Access denied for an unknown subject.").pipe(
          Effect.annotateLogs({ action, kind: name })
        )
      )
    );
    yield* check(action, row);
    return row;
  });

  /** The actions of this kind the caller may perform on a loaded subject. */
  const allowed = Effect.fn("access.allowed")(function* (row: Row) {
    const member = yield* Member;
    const placement = yield* implementation.place(row);
    const relations = yield* relationsOf(row, member);
    const granted = yield* Effect.filter(HashMap.toEntries(rules), ([, rule]) =>
      decide(rule, placement, member, relations).pipe(
        Effect.map((decision) => decision === "allow")
      )
    );
    return Arr.filter(
      Arr.map(granted, ([action]) => action),
      Schema.is(Action)
    );
  });

  /**
   * Records one audited change about a subject in the caller's transaction,
   * so a failed or retried mutation leaves no entry. The entry's owner and
   * reference come from the row, never from the caller, so it is filed only
   * under the subject's space. One insert and no reads, so concurrent
   * mutations never conflict here.
   */
  const record = Effect.fn("journal.record")(function* (
    actor: typeof Actor.Type,
    row: Row,
    change: typeof Change.Type
  ) {
    const subject = yield* Schema.decodeUnknownEffect(ObjectRef)({
      id: row._id,
      kind: name,
    }).pipe(Effect.orDie);
    return yield* (yield* DatabaseWriter)
      .table("journalEntries")
      .insert({
        actor,
        change,
        owner: { kind: "tenant", tenantId: implementation.tenantOf(row) },
        subject,
      })
      .pipe(Effect.orDie);
  });

  /**
   * The strategy of this kind's access middleware: decode the subject's ID
   * from the `arg` argument, authorize the action on it, and provide the row
   * as the kind's subject service. A second attachment of the same kind spec
   * would shadow the first subject, so it dies; handlers check further
   * objects of the kind with `authorize`.
   */
  const middleware = <I>(
    subject: Context.Key<I, Row>
  ): MiddlewareSpec.MiddlewareImpl<
    I,
    AccessDenied,
    DatabaseReader | Member,
    typeof Options.Type
  > =>
    Effect.fn("access.middleware")(function* (effect, { invocation, options }) {
      if (Option.isSome(yield* Effect.serviceOption(subject))) {
        return yield* Effect.die(
          `The ${name} access middleware is attached twice; check further ${name} objects with authorize.`
        );
      }
      const id = yield* Schema.decodeUnknownEffect(SubjectId)(
        Predicate.hasProperty(invocation.args, options.arg)
          ? invocation.args[options.arg]
          : undefined
      ).pipe(Effect.orDie);
      return yield* effect.pipe(
        Effect.provideService(subject, yield* authorize(options.action, id))
      );
    });

  return { allowed, authorize, check, middleware, record };
};

/** Constructors a lane uses to implement its kinds. */
export const Authority = { load, make };
