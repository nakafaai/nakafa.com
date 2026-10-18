import { MiddlewareImpl } from "@confect/server";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import {
  Sitting,
  SittingAccess,
} from "@repo/backend/confect/exams/sittings/access";
import { sittingKind } from "@repo/backend/confect/exams/sittings/kinds";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { scopePlace } from "@repo/backend/confect/tenancy/authority";
import { Effect } from "effect";

/**
 * Whether the Person is the account that created the sitting's exam. Only a claimed
 * Person has an account, so an unclaimed Person is never the author.
 */
const isExamAuthor = Effect.fn("exams.sittings.examAuthor")(function* (
  examId: ExamSittingsDoc["examId"],
  member: Member["Service"]
) {
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(examId)
    .pipe(Effect.orDie);
  const { account } = member.person;
  return account.state === "claimed" && exam.createdBy === account.userId;
});

/**
 * A sitting sits in its unit, so an archived unit locks it, and a closed sitting is
 * locked as well (ADR 0012, decision 3).
 */
export const sittingAuthority = Authority.make(
  sittingKind,
  Authority.load(sittingKind),
  {
    place: (row) =>
      scopePlace({ kind: "unit", unitId: row.unitId }).pipe(
        Effect.map((placement) => ({
          locked: placement.locked || row.state === "closed",
          units: placement.units,
        }))
      ),
    relations: {
      examAuthor: (row, member) => isExamAuthor(row.examId, member),
    },
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks a sitting action on the sitting its access spec names, and provides the loaded sitting. */
export const sittingAccess = MiddlewareImpl.make(
  databaseSchema,
  SittingAccess,
  sittingAuthority.middleware(Sitting)
);
