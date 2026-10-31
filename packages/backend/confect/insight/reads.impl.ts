import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { chanceOf } from "@repo/backend/confect/insight/mastery";
import spec from "@repo/backend/confect/insight/reads.spec";
import { narrativeField } from "@repo/backend/confect/insight/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { schemeForEntry } from "@repo/backend/confect/records/version";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

/** The students one class view reads: more than a cohort holds. */
const STUDENT_PAGE = 100;

/** The competencies one student shows: more than one class's exams name. */
const SKILL_PAGE = 50;

/** A student's standing in every competency on record. */
const skillsOf = Effect.fn("insight.reads.skills")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  const rows = yield* (yield* DatabaseReader)
    .table("insightMastery")
    .index("by_personId_and_competency", (query) =>
      query.eq("personId", personId)
    )
    .take(SKILL_PAGE)
    .pipe(Effect.orDie);
  return Arr.map(
    rows,
    Struct.pick(["competency", "earned", "observations", "possible", "rating"])
  );
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
        const skills = yield* skillsOf(personId);
        return {
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
          skills: Arr.map(skills, (skill) => ({
            ...skill,
            chance: chanceOf(skill.earned, skill.possible, scheme.kktp),
          })),
        };
      })
    );
    return { kktp: scheme.kktp, students };
  })
);

/** The viewer's own standing in every competency, without a chance. */
const mine = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("insight.reads.mine")(function* () {
    const { person } = yield* Member;
    return yield* skillsOf(person._id);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(ofClass),
  Layer.provide(mine),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
