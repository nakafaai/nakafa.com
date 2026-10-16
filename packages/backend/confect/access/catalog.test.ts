import { describe, expect, it } from "@effect/vitest";
import {
  Change,
  entries,
  kinds,
  ObjectRef,
  opensTo,
  TenantAction,
  TenantCapabilities,
} from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Rule } from "@repo/backend/confect/access/schema";
import { person } from "@repo/backend/confect/tenancy/kinds";
import { Array as Arr, Option, Order, pipe, Record, Schema } from "effect";

/**
 * The most changes one kind may hold, and the most kinds that may hold any.
 * Confect 10.3.0 fails with TS2589 above about 40 union members in a stored
 * document, and the journal stores the union of one kind's changes.
 */
const LIMIT = 40;

/** Why a kind past the limit fails the test, and the two ways to fix it. */
const LIMIT_MESSAGE = `Confect 10.3.0 fails with TS2589 above about ${LIMIT} union members in a stored document. Split the kind, or group kinds by domain one level higher.`;

/** The two facts of a catalog entry that the limit reads: its kind and the changes it adds. */
const CountedEntry = Schema.Struct({
  changes: Schema.Array(Schema.Unknown),
  kind: Schema.String,
});

/** The changes a kind holds across its declaration and every extension. */
const countOf = (
  catalog: readonly (typeof CountedEntry.Type)[],
  kind: string
) =>
  Arr.reduce(catalog, 0, (total, entry) =>
    entry.kind === kind ? total + Arr.length(entry.changes) : total
  );

/** Each kind that holds more changes than the limit, with its count. */
const overLimit = (catalog: readonly (typeof CountedEntry.Type)[]) =>
  Arr.flatMap(ObjectRef.discriminants, (kind) => {
    const count = countOf(catalog, kind);
    return count > LIMIT ? [{ count, kind }] : [];
  });

/** The kinds that hold at least one change. */
const holding = (catalog: readonly (typeof CountedEntry.Type)[]) =>
  Arr.filter(ObjectRef.discriminants, (kind) => countOf(catalog, kind) > 0);

/** A fixture: one change more than the limit on the person kind. */
const overfull = Kind.extend(person, {
  actions: {},
  changes: Arr.makeBy(LIMIT + 1, (index) =>
    Schema.Struct({ type: Schema.Literal(`person.overfull${index}`) })
  ),
  published: [],
});

describe("access/catalog", () => {
  it("derives one object reference per declared kind", () => {
    expect(ObjectRef.discriminants).toEqual([
      "tenant",
      "unit",
      "person",
      "period",
      "cohort",
      "promotion",
      "grant",
      "integration",
      "class",
      "visit",
    ]);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "person" })).toBe(true);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "invoice" })).toBe(false);
  });

  it("opens exactly the roster reads of a school to the integration role", () => {
    const opened = Arr.flatMap(entries, (entry) =>
      Arr.filter(Record.keys<string, Rule>(entry.actions), (action) =>
        opensTo(action, "integration")
      )
    );
    expect(Arr.sort(Arr.dedupe(opened), Order.String)).toEqual([
      "cohort.view",
      "period.view",
      "person.view",
    ]);
  });

  it("derives every change of every kind and extension", () => {
    expect(
      Arr.map(Change.members, (change) => change.fields.type.literal)
    ).toEqual([
      "tenant.provisioned",
      "tenant.locale.set",
      "tenant.policy.set",
      "unit.created",
      "unit.locale.set",
      "unit.archived",
      "unit.unarchived",
      "person.created",
      "person.invited",
      "person.claimed",
      "person.released",
      "person.removed",
      "person.renamed",
      "person.placed",
      "person.moved",
      "person.graduated",
      "invite.expired",
      "invite.resent",
      "invite.revoked",
      "card.issued",
      "card.reissued",
      "card.redeemed",
      "period.created",
      "period.opened",
      "period.archived",
      "cohort.created",
      "cohort.renamed",
      "cohort.archived",
      "assignment.created",
      "assignment.removed",
      "promotion.applied",
      "promotion.approved",
      "promotion.cancelled",
      "promotion.created",
      "promotion.opened",
      "promotion.planned",
      "promotion.studentPlanned",
      "promotion.submitted",
      "promotion.returned",
      "promotion.undone",
      "integration.created",
      "integration.rotated",
      "integration.revoked",
      "class.created",
      "class.renamed",
      "class.archived",
      "class.teacherAssigned",
      "class.teacherRemoved",
      "visit.requested",
      "visit.approved",
      "visit.declined",
      "visit.ended",
      "grant.created",
      "grant.ended",
      "tenant.suspended",
      "tenant.reactivated",
      "person.reactivated",
      "person.suspended",
    ]);
  });

  it("names only its kind's declared relations in every rule", () => {
    const undeclared = Arr.flatMap(entries, (entry) => {
      const declared = pipe(
        Arr.findFirst(kinds, (kind) => kind.kind === entry.kind),
        Option.map((kind) => kind.relations),
        Option.getOrElse(Arr.empty)
      );
      return pipe(
        Record.values<string, Rule>(entry.actions),
        Arr.flatMap((rule) => rule.relations),
        Arr.filter((relation) => !Arr.contains(declared, relation))
      );
    });
    expect(undeclared).toEqual([]);
  });

  it("rules each action of a kind once, so no lane redefines another lane's rule", () => {
    const repeated = Arr.flatMap(ObjectRef.discriminants, (kind) => {
      const actions = Arr.flatMap(Kind.of(entries, kind), (entry) =>
        Record.keys<string, Rule>(entry.actions)
      );
      return Arr.filter(
        Arr.dedupe(actions),
        (action) =>
          Arr.length(Arr.filter(actions, (other) => other === action)) > 1
      );
    });
    expect(repeated).toEqual([]);
  });

  it("publishes only change types its kind declares", () => {
    const undeclared = Arr.flatMap(ObjectRef.discriminants, (kind) => {
      const declared = Arr.map(
        Kind.changes(entries, kind).members,
        (change) => change.fields.type.literal
      );
      return pipe(
        Kind.of(entries, kind),
        Arr.flatMap((entry): readonly string[] => entry.published),
        Arr.filter((type) => !Arr.some(declared, (known) => known === type))
      );
    });
    expect(undeclared).toEqual([]);
  });

  it("joins tenant actions from the tenant kind and every extension of it", () => {
    expect(
      Arr.flatMap(TenantAction.members, (member) => member.literals)
    ).toEqual([
      "audit.view",
      "tenant.manage",
      "tenant.view",
      "invite.view",
      "person.manage",
      "person.view",
      "grant.manage",
      "owner.manage",
      "integration.manage",
      "integration.view",
      "visit.approve",
    ]);
  });

  it("drops capabilities an older client does not know instead of failing", () => {
    const capabilities = Schema.decodeSync(TenantCapabilities)([
      "tenant.view",
      "classroom.create",
    ]);
    expect(capabilities).toEqual(["tenant.view"]);
    expect(Schema.encodeSync(TenantCapabilities)(capabilities)).toEqual([
      "tenant.view",
    ]);
  });

  it("keeps every kind within the stored union limit", () => {
    expect(overLimit(entries), LIMIT_MESSAGE).toEqual([]);
  });

  it("keeps the kinds that hold changes within the stored union limit", () => {
    expect(Arr.length(holding(entries)), LIMIT_MESSAGE).toBeLessThanOrEqual(
      LIMIT
    );
  });

  it("names a kind that holds more changes than the limit", () => {
    expect(
      Arr.map(overLimit([...entries, overfull]), (over) => over.kind)
    ).toEqual(["person"]);
  });
});
