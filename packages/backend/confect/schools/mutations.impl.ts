import {
  DatabaseReader,
  DatabaseWriter,
  FunctionImpl,
  GroupImpl,
} from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { generateUniqueSlug } from "@repo/backend/confect/schools/allocation";
import {
  SchoolCreateError,
  SchoolReadError,
} from "@repo/backend/confect/schools/errors";
import {
  validateInviteCodeState,
  validateNotExistingMembership,
} from "@repo/backend/confect/schools/invitations";
import { InvitationError } from "@repo/backend/confect/schools/invitations/spec";
import spec from "@repo/backend/confect/schools/mutations.spec";
import { generateNanoId } from "@repo/backend/confect/utils/id";
import { slugify } from "@repo/backend/confect/utils/text";
import { Clock, Effect, Layer } from "effect";

/**
 * Create a new school and automatically add the creator as an admin member.
 * The creator becomes the admin of the school automatically.
 */
const createSchool = FunctionImpl.make(
  databaseSchema,
  spec,
  "createSchool",
  Effect.fn("schools.mutations.createSchool")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const user = yield* requireAuth(ctx);

    // Check if school with same email already exists
    const existingSchoolByEmail = yield* database
      .table("schools")
      .get("by_email", args.email)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (existingSchoolByEmail) {
      return yield* new SchoolCreateError({
        code: "SCHOOL_ALREADY_EXISTS",
        message: "A school with this email already exists.",
      });
    }

    // Generate unique slug
    const baseSlug = slugify(args.name);
    const uniqueSlug = yield* generateUniqueSlug(ctx, baseSlug);
    const now = yield* Clock.currentTimeMillis;
    const userId = user.appUser._id;

    // Create school
    const schoolId = yield* writer
      .table("schools")
      .insert({
        name: args.name,
        slug: uniqueSlug,
        email: args.email,
        phone: args.phone,
        address: args.address,
        city: args.city,
        province: args.province,
        type: args.type,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
        currentStudents: 0,
        currentTeachers: 0,
      })
      .pipe(Effect.orDie);

    // Create school member record - creator becomes admin automatically
    yield* writer
      .table("schoolMembers")
      .insert({
        schoolId,
        userId,
        role: "admin",
        status: "active",
        joinedAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);

    // Generate invite codes for each role
    const roles = ["teacher", "student", "parent", "demo"] as const;
    for (const role of roles) {
      yield* writer
        .table("schoolInviteCodes")
        .insert({
          schoolId,
          role,
          code: generateNanoId(),
          enabled: true,
          currentUsage: 0,
          createdBy: userId,
          updatedBy: userId,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    }
    return {
      schoolId,
      slug: uniqueSlug,
    };
  })
);
const joinSchool = FunctionImpl.make(
  databaseSchema,
  spec,
  "joinSchool",
  Effect.fn("schools.mutations.joinSchool")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const user = yield* requireAuth(ctx);

    // Find invite code
    const inviteCode = yield* database
      .table("schoolInviteCodes")
      .get("by_code", args.code)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!inviteCode) {
      return yield* new InvitationError({
        code: "INVALID_CODE",
        message: "Invalid invite code.",
      });
    }
    yield* validateInviteCodeState(inviteCode);

    // Get school
    const school = yield* database
      .table("schools")
      .get(inviteCode.schoolId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!school) {
      return yield* new SchoolReadError({
        code: "SCHOOL_NOT_FOUND",
        message: "School not found.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const userId = user.appUser._id;

    // Check if user is already a member
    const existingMember = yield* database
      .table("schoolMembers")
      .get("by_schoolId_and_userId_and_status", school._id, userId, "active")
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    yield* validateNotExistingMembership(existingMember, "school");

    // Add user as member with role from invite code
    yield* writer
      .table("schoolMembers")
      .insert({
        schoolId: school._id,
        userId,
        role: inviteCode.role,
        status: "active",
        inviteCodeId: inviteCode._id,
        // Track which code was used (trigger will update usage count)
        joinedAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      schoolId: school._id,
      slug: school.slug,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(createSchool),
  Layer.provide(joinSchool),
  Layer.provide(atomic),
  GroupImpl.finalize
);
