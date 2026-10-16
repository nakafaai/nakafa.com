import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { Exam, ExamAccess } from "@repo/backend/confect/exams/access";
import { examKind } from "@repo/backend/confect/exams/kinds";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Effect } from "effect";

/** Reads the unit an exam names; an exam always names an existing unit, so a missing one is a defect. */
const readUnit = Effect.fnUntraced(function* (
  unitId: GenericId.GenericId<"tenantUnits">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
});

/**
 * An exam in a unit sits in that unit, so an archived unit locks its edits. A
 * tenant-wide exam sits in no unit, so nothing locks it but the school's suspension,
 * which the decision already reads.
 */
export const examAuthority = Authority.make(
  examKind,
  Authority.load(examKind),
  {
    place: (row) =>
      GrantScope.match(row.scope, {
        tenant: () => Effect.succeed({ locked: false, units: [] }),
        unit: ({ unitId }) =>
          readUnit(unitId).pipe(
            Effect.map((unit) => ({
              locked: unit.status === "archived",
              units: [unitId],
            }))
          ),
      }),
    relations: {},
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks an exam action on the exam its access spec names, and provides the loaded exam to the function. */
export const examAccess = MiddlewareImpl.make(
  databaseSchema,
  ExamAccess,
  examAuthority.middleware(Exam)
);

/**
 * Decides `exam.edit` on the scope a new exam covers, as a document is decided: the
 * member's tenant for a tenant-wide exam, and the unit for a unit exam, which the
 * unit's own rules then decide.
 */
export const authorizeScope = Effect.fn("exams.authority.scope")(function* (
  scope: GrantScope
) {
  const { tenant } = yield* Member;
  yield* GrantScope.match(scope, {
    tenant: () => tenantAuthority.check("exam.edit", tenant),
    unit: ({ unitId }) =>
      Effect.asVoid(unitAuthority.authorize("exam.edit", unitId)),
  });
});
