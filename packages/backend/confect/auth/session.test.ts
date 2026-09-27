import { Ref } from "@confect/core";
import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { authReader } from "@repo/backend/confect/auth/reader";
import {
  getOptionalActiveAppUser,
  getOptionalAppUserForRead,
  requireAuth,
  requireAuthForAction,
} from "@repo/backend/confect/auth/session";
import { AuthFailure, SessionRequired } from "@repo/backend/confect/auth/spec";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Option, Schema } from "effect";

const NOW = Date.UTC(2026, 6, 28, 11, 0, 0);
afterEach(() => vi.restoreAllMocks());
describe("session-validated app identity", () => {
  it("resolves the same active account for reads, writes, and actions", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "active-auth",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    expect(
      await authenticated.query((ctx) =>
        runConvexProgram(getOptionalAppUserForRead(ctx))
      )
    ).toMatchObject({
      appUser: {
        _id: identity.userId,
      },
    });
    expect(
      await authenticated.mutation((ctx) =>
        runConvexProgram(getOptionalActiveAppUser(ctx))
      )
    ).toMatchObject({
      appUser: {
        _id: identity.userId,
      },
    });
    expect(
      await authenticated.query((ctx) => runConvexProgram(requireAuth(ctx)))
    ).toMatchObject({
      appUser: {
        _id: identity.userId,
      },
    });
    expect(
      await authenticated.action((ctx) =>
        runConvexProgram(requireAuthForAction(ctx))
      )
    ).toMatchObject({
      appUser: {
        _id: identity.userId,
      },
    });
  });
  it("does not trust an identity whose Better Auth session expired", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "expired-auth",
        sessionDurationMs: 0,
      })
    );
    const expired = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    for (const caller of [t, expired]) {
      expect(
        await caller.query((ctx) =>
          runConvexProgram(getOptionalAppUserForRead(ctx))
        )
      ).toBeNull();
      expect(
        await caller.mutation((ctx) =>
          runConvexProgram(getOptionalActiveAppUser(ctx))
        )
      ).toBeNull();
      const failure = await caller
        .mutation(api.chats.mutations.createChat, { type: "study" })
        .catch((error: unknown) => error);
      assert(Ref.isConvexError(failure));
      expect(failure.data).toBe("Unauthenticated");
      const decoded = Ref.decodeErrorOption(
        refs.public.chats.mutations.createChat,
        failure.data
      );
      assert(Option.isSome(decoded));
      expect(decoded.value).toBeInstanceOf(SessionRequired);
      expect(Schema.encodeSync(AuthFailure)(decoded.value)).toBe(
        "Unauthenticated"
      );
    }
  });
  it("rejects a removed account and prevents deleted users from becoming anonymous writers", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "removed-auth",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, {
        deletedAt: NOW,
      })
    );
    expect(
      await authenticated.query((ctx) =>
        runConvexProgram(getOptionalAppUserForRead(ctx))
      )
    ).toBeNull();
    expect(
      await authenticated.mutation((ctx) =>
        runConvexProgram(
          getOptionalActiveAppUser(ctx).pipe(
            Effect.flip,
            Effect.orDie,
            Effect.map(({ _tag, code, message }) => ({
              _tag,
              code,
              message,
            }))
          )
        )
      )
    ).toMatchObject({
      _tag: "AccountUnavailable",
      code: "UNAUTHORIZED",
    });
    await t.mutation((ctx) => ctx.db.delete("users", identity.userId));
    expect(
      await authenticated.query((ctx) =>
        runConvexProgram(getOptionalAppUserForRead(ctx))
      )
    ).toBeNull();
    expect(
      await authenticated.query((ctx) =>
        runConvexProgram(
          requireAuth(ctx).pipe(
            Effect.flip,
            Effect.orDie,
            Effect.map(({ _tag, code, message }) => ({
              _tag,
              code,
              message,
            }))
          )
        )
      )
    ).toMatchObject({
      _tag: "AccountUnavailable",
      code: "UNAUTHORIZED",
    });
    expect(
      await authenticated.action((ctx) =>
        runConvexProgram(
          requireAuthForAction(ctx).pipe(
            Effect.flip,
            Effect.orDie,
            Effect.map(({ _tag, code, message }) => ({
              _tag,
              code,
              message,
            }))
          )
        )
      )
    ).toMatchObject({
      _tag: "AccountUnavailable",
      code: "UNAUTHORIZED",
    });
  });
  it("fails closed with a typed, sanitized error when the session component is unavailable", async () => {
    vi.spyOn(authReader, "safeGetAuthUser").mockRejectedValueOnce(
      new Error("private adapter details")
    );
    const t = createConvexTestWithBetterAuth();
    const failure = await t.query((ctx) =>
      runConvexProgram(
        requireAuth(ctx).pipe(
          Effect.flip,
          Effect.orDie,
          Effect.map(({ _tag, code, message }) => ({
            _tag,
            code,
            message,
          }))
        )
      )
    );
    expect(failure).toMatchObject({
      _tag: "AuthReadError",
    });
    assert(failure.code === "AUTH_READ_FAILED");
    expect(
      Schema.encodeSync(AuthFailure)(
        Schema.decodeUnknownSync(AuthFailure)({
          code: failure.code,
          message: failure.message,
        })
      )
    ).toEqual({
      code: "AUTH_READ_FAILED",
      message: "Unable to read authentication state.",
    });
  });
  it("keeps prepared users readable while rejecting new mutations", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-auth",
      })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const optionalUserId = await authenticated.query(async (ctx) => {
      const auth = await runConvexProgram(getOptionalAppUserForRead(ctx));
      return auth?.appUser._id ?? null;
    });
    expect(optionalUserId).toBe(identity.userId);
    await expect(
      authenticated.mutation(async (ctx) => {
        const auth = await runConvexProgram(getOptionalActiveAppUser(ctx));
        return auth?.appUser._id ?? null;
      })
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
      },
    });
    await expect(
      authenticated.query(
        async (ctx) => await runConvexProgram(requireAuth(ctx))
      )
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
      },
    });
  });
  it("rejects prepared users when an in-flight action re-enters Convex", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-action",
      })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      })
    );
    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .action(
          async (ctx) => await runConvexProgram(requireAuthForAction(ctx))
        )
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
      },
    });
  });
});
