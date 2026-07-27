import {
  AuthRelationCleanupError,
  cleanupAuthRelations,
} from "@repo/backend/convex/auth/cleanup/relations";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

describe("auth cleanup relations", () => {
  it("deletes membership, invitation, and verification rows", async () => {
    const deleteRows = vi.fn(async () => 1);

    await Effect.runPromise(
      cleanupAuthRelations(deleteRows, {
        email: "deleted@example.com",
        id: "auth-user",
      })
    );

    expect(deleteRows.mock.calls).toEqual([
      [
        {
          model: "member",
          where: [{ field: "userId", value: "auth-user" }],
        },
      ],
      [
        {
          model: "invitation",
          where: [{ field: "inviterId", value: "auth-user" }],
        },
      ],
      [
        {
          model: "invitation",
          where: [{ field: "email", value: "deleted@example.com" }],
        },
      ],
      [
        {
          model: "verification",
          where: [{ field: "identifier", value: "deleted@example.com" }],
        },
      ],
    ]);
  });

  it("returns a typed failure when auth relation cleanup fails", async () => {
    const deleteRows = vi.fn(() =>
      Promise.reject(new Error("adapter unavailable"))
    );

    const failure = await Effect.runPromise(
      cleanupAuthRelations(deleteRows, {
        email: "deleted@example.com",
        id: "auth-user",
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AuthRelationCleanupError);
    expect(failure).toMatchObject({
      _tag: "AuthRelationCleanupError",
      code: "AUTH_RELATION_CLEANUP_FAILED",
    });
  });
});
