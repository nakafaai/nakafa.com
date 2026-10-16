import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority } from "@repo/backend/confect/access/policy";
import { Visit, VisitAccess } from "@repo/backend/confect/operators/access";
import { visit } from "@repo/backend/confect/operators/kinds";
import { Effect } from "effect";

/**
 * A visit is never locked. Its visitor holds the `visitor` relation only while
 * the visit is approved and names that operator's Person.
 */
export const visitAuthority = Authority.make(visit, Authority.load(visit), {
  place: () => Effect.succeed({ locked: false, units: [] }),
  relations: {
    visitor: (row, member) =>
      Effect.succeed(
        row.state.status === "approved" &&
          row.state.personId === member.person._id
      ),
  },
  tenantOf: (row) => row.tenantId,
});

/** Checks a visit action on the visit whose ID the request names, and provides that visit. */
export const visitAccess = MiddlewareImpl.make(
  databaseSchema,
  VisitAccess,
  visitAuthority.middleware(Visit)
);
