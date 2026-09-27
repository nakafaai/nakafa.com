import { DatabaseReader, FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { SchoolReadError } from "@repo/backend/confect/schools/errors";
import { getSchoolMembership } from "@repo/backend/confect/schools/membership";
import spec from "@repo/backend/confect/schools/queries.spec";
import { Effect, Layer } from "effect";

/** Return the authenticated school route snapshot resolved from one slug. */
const getSchoolBySlug = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSchoolBySlug",
  Effect.fn("schools.queries.getSchoolBySlug")(function* (args) {
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const user = yield* requireAuth(ctx);
    const school = yield* database
      .table("schools")
      .get("by_slug", args.slug)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!school) {
      return yield* new SchoolReadError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for slug: ${args.slug}`,
      });
    }
    const membership = yield* getSchoolMembership(
      ctx,
      school._id,
      user.appUser._id
    );
    if (!membership) {
      return yield* new SchoolReadError({
        code: "MEMBERSHIP_NOT_FOUND",
        message: `Membership not found for schoolId: ${school._id} and userId: ${user.appUser._id}`,
      });
    }
    return {
      school,
      membership,
    };
  })
);
const getMySchoolLandingState = FunctionImpl.make(
  databaseSchema,
  spec,
  "getMySchoolLandingState",
  Effect.fn("schools.queries.getMySchoolLandingState")(function* () {
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const user = yield* requireAuth(ctx);
    const memberships = yield* database
      .table("schoolMembers")
      .index("by_userId_and_status", (q) =>
        q.eq("userId", user.appUser._id).eq("status", "active")
      )
      .take(2)
      .pipe(Effect.orDie);
    if (memberships.length === 0) {
      return {
        kind: "none" as const,
      };
    }
    if (memberships.length > 1) {
      return {
        kind: "multiple" as const,
      };
    }
    const school = yield* database
      .table("schools")
      .get(memberships[0].schoolId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!school) {
      return yield* new SchoolReadError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for schoolId: ${memberships[0].schoolId}`,
      });
    }
    return {
      kind: "single" as const,
      slug: school.slug,
    };
  })
);
const getMySchoolsPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getMySchoolsPage",
  Effect.fn("schools.queries.getMySchoolsPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const user = yield* requireAuth(ctx);
    const memberships = yield* database
      .table("schoolMembers")
      .index("by_userId_and_status", (q) =>
        q.eq("userId", user.appUser._id).eq("status", "active")
      )
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const schools = yield* Effect.forEach(
      memberships.page,
      Effect.fn(function* (membership) {
        const school = yield* database
          .table("schools")
          .get(membership.schoolId)
          .pipe(
            Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
            Effect.orDie
          );
        if (!school) {
          return yield* new SchoolReadError({
            code: "SCHOOL_NOT_FOUND",
            message: `School not found for schoolId: ${membership.schoolId}`,
          });
        }
        return school;
      })
    );
    return {
      ...memberships,
      page: schools.map((school) => ({
        _id: school._id,
        name: school.name,
        slug: school.slug,
        type: school.type,
      })),
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getSchoolBySlug),
  Layer.provide(getMySchoolLandingState),
  Layer.provide(getMySchoolsPage),
  GroupImpl.finalize
);
