import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { InsightMasteryDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { CLASS_LIMIT, classView } from "@repo/backend/confect/classroom/class";
import {
  activePeriodsOf,
  sidebarOrder,
} from "@repo/backend/confect/classroom/classes/mine";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { mayIn } from "@repo/backend/confect/classroom/roster";
import { chanceOf } from "@repo/backend/confect/insight/mastery";
import { sharedPracticeOf } from "@repo/backend/confect/insight/practice";
import spec from "@repo/backend/confect/insight/reads.spec";
import {
  draftField,
  narrativeField,
} from "@repo/backend/confect/insight/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { schemeForEntry } from "@repo/backend/confect/records/version";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Layer, Option, pipe, Struct } from "effect";

/** The students one class view reads: more than a cohort holds. */
const STUDENT_PAGE = 100;

/** The competencies one student shows: more than one class's exams name. */
const SKILL_PAGE = 50;

/** What a reader sees of one standing. */
const skillOf = (row: InsightMasteryDoc) =>
  Struct.pick(row, [
    "competency",
    "earned",
    "observations",
    "possible",
    "rating",
  ]);

/** A student's standing in every competency of one period. */
const skillsOf = Effect.fn("insight.reads.skills")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  const rows = yield* (yield* DatabaseReader)
    .table("insightMastery")
    .index("by_personId_and_periodId_and_competency", (query) =>
      query.eq("personId", personId).eq("periodId", periodId)
    )
    .take(SKILL_PAGE)
    .pipe(Effect.orDie);
  return Arr.map(rows, skillOf);
});

/** Whether the forecast may be shown: the newest month's test passed, or no month has tested it yet. */
const forecastsOn = Effect.fn("insight.reads.forecasts")(function* () {
  const newest = yield* (yield* DatabaseReader)
    .table("insightCalibrations")
    .index("by_month", "desc")
    .first()
    .pipe(Effect.orDie);
  return Option.match(newest, {
    onNone: () => true,
    onSome: (test) => test.passed,
  });
});

/** A class's students, each with their standing, their chance of the KKTP, and the teacher's narrative. */
const ofClass = FunctionImpl.make(
  databaseSchema,
  spec,
  "ofClass",
  Effect.fn("insight.reads.ofClass")(function* () {
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const scheme = yield* schemeForEntry(row.tenantId);
    const forecasts = yield* forecastsOn();
    const keys = yield* schoolKeys(row.tenantId);
    const members = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row.cohortId)
      )
      .take(STUDENT_PAGE)
      .pipe(Effect.orDie);
    const students = yield* Effect.forEach(members, ({ personId }) =>
      Effect.gen(function* () {
        const person = yield* reader
          .table("tenantPeople")
          .get(personId)
          .pipe(Effect.orDie);
        const narrative = yield* reader
          .table("insightNarratives")
          .index("by_classId_and_personId", (query) =>
            query.eq("classId", row._id).eq("personId", personId)
          )
          .first()
          .pipe(Effect.orDie);
        const draft = yield* reader
          .table("insightDrafts")
          .index("by_classId_and_personId", (query) =>
            query.eq("classId", row._id).eq("personId", personId)
          )
          .first()
          .pipe(Effect.orDie);
        const skills = yield* skillsOf(personId, row.periodId);
        return {
          draft: Option.isSome(draft)
            ? {
                text:
                  draft.value.sealedText === undefined
                    ? null
                    : yield* openText(
                        keys,
                        draftField(draft.value),
                        draft.value.sealedText
                      ).pipe(Effect.orDie),
              }
            : null,
          id: personId,
          name: person.name,
          narrative: Option.isSome(narrative)
            ? {
                shared: narrative.value.sharedAt !== undefined,
                text: yield* openText(
                  keys,
                  narrativeField(narrative.value),
                  narrative.value.sealedText
                ).pipe(Effect.orDie),
              }
            : null,
          practice: yield* sharedPracticeOf(person),
          skills: Arr.map(skills, (skill) => ({
            ...skill,
            chance: forecasts
              ? chanceOf(skill.earned, skill.possible, scheme.kktp)
              : null,
          })),
        };
      })
    );
    return { forecasts, kktp: scheme.kktp, students };
  })
);

/**
 * The active classes of the school's active periods whose Insight the viewer reads, in the sidebar's order. A leader
 * reads every one and a teacher their own, so the page offers exactly what `ofClass` answers.
 */
const classes = FunctionImpl.make(
  databaseSchema,
  spec,
  "classes",
  Effect.fn("insight.reads.classes")(function* () {
    const principal = yield* Member;
    const reader = yield* DatabaseReader;
    const held = yield* Effect.forEach(
      yield* activePeriodsOf(principal.tenant._id),
      (period) =>
        reader
          .table("classes")
          .index("by_periodId_and_slug", (query) =>
            query.eq("periodId", period._id)
          )
          .take(CLASS_LIMIT)
          .pipe(Effect.orDie)
    );
    const readable = yield* Effect.filter(
      Arr.filter(Arr.flatten(held), (row) => row.status === "active"),
      (row) => mayIn("insight.view", row, principal)
    );
    return pipe(readable, sidebarOrder, Arr.map(classView));
  })
);

/** The viewer's own standing in every competency of their newest period, without a chance. */
const mine = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("insight.reads.mine")(function* () {
    const { person } = yield* Member;
    const rows = yield* (yield* DatabaseReader)
      .table("insightMastery")
      .index("by_personId_and_periodId_and_competency", (query) =>
        query.eq("personId", person._id)
      )
      .take(SKILL_PAGE)
      .pipe(Effect.orDie);
    const newest = Arr.reduce(
      rows,
      Option.none<(typeof rows)[number]>(),
      (kept, row) =>
        Option.isSome(kept) && kept.value.updatedAt >= row.updatedAt
          ? kept
          : Option.some(row)
    );
    return Arr.map(
      Arr.filter(rows, (row) =>
        Option.exists(newest, (kept) => kept.periodId === row.periodId)
      ),
      skillOf
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(classes),
  Layer.provide(ofClass),
  Layer.provide(mine),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
