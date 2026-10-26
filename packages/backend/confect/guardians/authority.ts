import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority, activeGrants } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import {
  GuardianLink,
  GuardianLinkAccess,
} from "@repo/backend/confect/guardians/access";
import { guardianLinkKind } from "@repo/backend/confect/guardians/kinds";
import { Array as Arr, Effect, pipe } from "effect";

/**
 * A link sits where its student sits: the units of the student's grants. An ended
 * link is locked, so no write reopens it. `guardian` holds for the link's own
 * guardian, and `verifiedParent` only while the link is verified (ADR 0034).
 */
export const guardianLinkAuthority = Authority.make(
  guardianLinkKind,
  Authority.load(guardianLinkKind),
  {
    place: (row) =>
      activeGrants(row.studentPersonId).pipe(
        Effect.map((grants) => ({
          locked: row.state.status === "ended",
          units: pipe(
            grants,
            Arr.map((grant) => grant.scope),
            Arr.filter(GrantScope.guards.unit),
            Arr.map((scope) => scope.unitId)
          ),
        }))
      ),
    relations: {
      guardian: (row, member) =>
        Effect.succeed(row.guardianPersonId === member.person._id),
      verifiedParent: (row, member) =>
        Effect.succeed(
          row.guardianPersonId === member.person._id &&
            row.state.status === "verified"
        ),
    },
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks a guardian link action on the link its access spec names, and provides the loaded link. */
export const guardianLinkAccess = MiddlewareImpl.make(
  databaseSchema,
  GuardianLinkAccess,
  guardianLinkAuthority.middleware(GuardianLink)
);

/** Reads one Person a link names; a link always names two, so a missing one is a defect. */
export const readLinkedPerson = Effect.fnUntraced(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
});
