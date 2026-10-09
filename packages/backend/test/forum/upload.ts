import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/confect/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr, Effect, Schema } from "effect";

/** Creates a real authorized upload capability for the route contract. */
export const createPendingUpload = Effect.fn(
  "test.forumAttachments.createPendingUpload"
)(function* (now: number) {
  const t = createConvexTestWithBetterAuth();
  const seeded = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now,
        suffix: "forum-upload-route",
      });
      const ownership = {
        now,
        userId: user.userId,
      };
      const schoolId = await insertSchool(ctx, ownership);
      const classId = await insertClass(ctx, {
        ...ownership,
        schoolId,
      });
      const membership = {
        ...ownership,
        role: "teacher",
        schoolId,
      } satisfies Parameters<typeof insertSchoolMembership>[1];
      await insertSchoolMembership(ctx, membership);
      await insertClassMembership(ctx, {
        ...membership,
        classId,
      });
      const forumId = await ctx.db.insert("schoolClassForums", {
        body: "Attachment forum body",
        classId,
        createdBy: user.userId,
        isPinned: false,
        lastPostAt: now,
        lastPostBy: user.userId,
        nextPostSequence: 1,
        postCount: 0,
        reactionCounts: [],
        schoolId,
        status: "open",
        tag: "general",
        title: "Attachment forum",
        updatedAt: now,
      });
      return {
        ...user,
        forumId,
      };
    })
  );
  const owner = t.withIdentity({
    sessionId: seeded.sessionId,
    subject: seeded.authUserId,
  });
  const upload = yield* Effect.promise(() =>
    owner.mutation(api.classes.forums.mutations.uploads.generateUploadUrl, {
      forumId: seeded.forumId,
    })
  );
  const capability = new URL(upload.uploadUrl);
  const lastSegment = yield* Effect.orDie(
    Effect.fromOption(Arr.last(capability.pathname.split("/")))
  );
  const uploadToken = yield* Schema.decodeUnknownEffect(Schema.NonEmptyString)(
    lastSegment
  );
  return {
    capabilityPath: capability.pathname,
    owner,
    seeded,
    t,
    uploadId: upload.uploadId,
    uploadToken,
  };
});
