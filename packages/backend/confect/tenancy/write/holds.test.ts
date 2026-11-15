import { GenericId } from "@confect/core";
import { DatabaseSchema } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import type { TableNames } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { Reference } from "@repo/backend/confect/tenancy/hold";
import { PROMOTION_SCAN } from "@repo/backend/confect/tenancy/promotion/hold";
import {
  cohortHold,
  cohortHolders,
  periodHold,
  periodHolders,
} from "@repo/backend/confect/tenancy/write/holds";
import {
  heldCohorts,
  heldPeriods,
  promotionRow,
  term,
} from "@repo/backend/test/holds";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import {
  Array as Arr,
  Effect,
  Match,
  Option,
  Order,
  Record as Rec,
  type SchemaAST,
} from "effect";

/**
 * Period fields that no read needs, each beside the reference that covers it: the row's period is always the period of
 * the cohort or class it belongs to, and that cohort or class holds the period while the row holds it.
 */
/**
 * Tables whose references may outlive their subject by design: the journal keeps every removal it records (ADR 0041),
 * and an inbox row reads its subject when it is opened and shows nothing of one that is gone (ADR 0027).
 */
const keptTables: readonly TableNames[] = ["journalEntries", "notifications"];

const coveredReferences: Readonly<Record<Reference, Reference>> = {
  "classTeachers.periodId": "classes.periodId",
  "graduationLetters.periodId": "tenantCohorts.periodId",
  "reportCards.periodId": "tenantCohorts.periodId",
  "tenantAssignments.periodId": "tenantCohorts.periodId",
  "tenantCohortMembers.periodId": "tenantCohorts.periodId",
};

const SUBJECTS = ["tenantCohorts", "tenantPeriods"];

/** Every path in a schema whose value is the ID of a cohort or a period, as `table.field`, `.inner`, or `[]` per array. */
const referencesIn = (
  ast: SchemaAST.AST,
  path: string,
  suspended: readonly SchemaAST.AST[]
): readonly string[] => {
  if (
    Option.exists(GenericId.tableName(ast), (table) =>
      Arr.contains(SUBJECTS, table)
    )
  ) {
    return [path];
  }
  return Match.value(ast).pipe(
    Match.tag("Objects", (node) => [
      ...Arr.flatMap(node.propertySignatures, (property) =>
        referencesIn(
          property.type,
          `${path}.${String(property.name)}`,
          suspended
        )
      ),
      ...Arr.flatMap(node.indexSignatures, (index) =>
        referencesIn(index.type, `${path}[*]`, suspended)
      ),
    ]),
    Match.tag("Arrays", (node) =>
      Arr.flatMap([...node.elements, ...node.rest], (item) =>
        referencesIn(item, `${path}[]`, suspended)
      )
    ),
    Match.tag("Union", (node) =>
      Arr.flatMap(node.types, (member) => referencesIn(member, path, suspended))
    ),
    Match.tag("Suspend", (node) =>
      Arr.containsWith((a: SchemaAST.AST, b: SchemaAST.AST) => a === b)(
        suspended,
        node
      )
        ? []
        : referencesIn(node.thunk(), path, [...suspended, node])
    ),
    Match.orElse(() => [])
  );
};

describe("tenancy/write/holds", () => {
  it("registers every field of the schema that points at a cohort or a period", () => {
    const found = Arr.dedupe(
      Arr.flatMap(
        Rec.toEntries(DatabaseSchema.tables(databaseSchema)),
        ([name, table]) =>
          Arr.contains(keptTables, name)
            ? []
            : referencesIn(table.Fields.ast, name, [])
      )
    );
    const declared = Arr.flatMap(
      [...cohortHolders, ...periodHolders],
      (holder) => holder.references
    );
    expect(
      Arr.sort([...declared, ...Rec.keys(coveredReferences)], Order.String)
    ).toEqual(Arr.sort(found, Order.String));
    expect(
      Arr.every(Rec.values(coveredReferences), (covering) =>
        Arr.contains(declared, covering)
      )
    ).toBe(true);
  });

  it.effect(
    "names each record that keeps a cohort in use, and none for a cohort that holds nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohorts, periodId } = yield* heldCohorts(fixture);
        const holds = yield* fixture.run(
          Effect.forEach(cohorts, (cohortId) =>
            Effect.map(
              cohortHold({ _id: cohortId, periodId }),
              Option.getOrNull
            )
          )
        );
        expect(holds).toEqual([
          "members",
          "homeroom",
          null,
          "classes",
          "sittings",
          "reports",
          "letters",
          "promotions",
          "promotions",
          null,
        ]);
      })
  );

  it.effect(
    "lets a promotion undo the cohorts it created, and holds every cohort of a period past the scan",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const source = yield* term(fixture, "archived", []);
        const target = yield* term(fixture, "planned", ["8A"]);
        const crowded = yield* term(fixture, "planned", ["9A"]);
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* writer
              .table("tenantPromotions")
              .insert(
                promotionRow(
                  fixture,
                  source.periodId,
                  target.periodId,
                  [],
                  target.cohorts,
                  true
                )
              );
            yield* Effect.forEach(
              Arr.range(1, PROMOTION_SCAN),
              () =>
                writer
                  .table("tenantPromotions")
                  .insert(
                    promotionRow(
                      fixture,
                      crowded.periodId,
                      source.periodId,
                      [],
                      []
                    )
                  ),
              { discard: true }
            );
          }).pipe(Effect.orDie)
        );
        const holds = yield* fixture.run(
          Effect.all([
            cohortHold({ _id: target.cohorts[0], periodId: target.periodId }),
            cohortHold({ _id: crowded.cohorts[0], periodId: crowded.periodId }),
          ]).pipe(Effect.map(Arr.map((hold) => Option.getOrNull(hold))))
        );
        expect(holds).toEqual([null, "promotions"]);
      })
  );

  it.effect(
    "names each reason a period stays in use, and none for a period that holds nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const periods = yield* heldPeriods(fixture);
        const holds = yield* fixture.run(
          Effect.forEach(periods, (periodId) =>
            Effect.map(
              periodHold({ _id: periodId, status: "archived" }),
              Option.getOrNull
            )
          )
        );
        expect(holds).toEqual([
          "cohorts",
          "classes",
          "grades",
          "graduations",
          "promotions",
          "promotions",
          "insight",
          "insight",
          "insight",
          null,
        ]);
        const active = yield* fixture.run(
          Effect.map(
            periodHold({ _id: periods[9], status: "active" }),
            Option.getOrNull
          )
        );
        expect(active).toBe("active");
      })
  );
});
