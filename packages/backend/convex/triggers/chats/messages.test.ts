import { beforeEach, describe, expect, it } from "@effect/vitest";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { createDeletedUserTombstone } from "@repo/backend/convex/auth/deletion/tombstone";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { messagesHandler } from "@repo/backend/convex/triggers/chats/messages";
import { Effect } from "effect";

vi.mock("@repo/backend/convex/analytics/capture", () => ({
  captureProductEvent: vi.fn(() => Effect.void),
}));

describe("chat message analytics", () => {
  beforeEach(() => vi.mocked(captureProductEvent).mockClear());
  it.each([
    "missing-chat",
    "missing-user",
    "deleted-user",
    "system",
    "failed-without-code",
  ] as const)(
    "does not emit a billable/product success for %s",
    async (scenario) => {
      const t = createConvexTestWithBetterAuth();
      await t.mutation(async (ctx) => {
        const user = await seedAuthenticatedUser(ctx, { now: Date.now() });
        const chatId = await ctx.db.insert("chats", {
          userId: user.userId,
          type: "study",
          visibility: "private",
          updatedAt: Date.now(),
        });
        const messageId = await ctx.db.insert("messages", {
          chatId,
          identifier: "orphan",
          role: scenario === "system" ? "system" : "assistant",
          ...(scenario === "failed-without-code"
            ? { generationStatus: "failed" as const }
            : {}),
        });
        const message = await ctx.db.get("messages", messageId);
        if (!message) {
          throw new Error("Fixture message missing");
        }
        if (scenario === "missing-chat") {
          await ctx.db.delete("chats", chatId);
        }
        if (scenario === "missing-user") {
          await ctx.db.delete("users", user.userId);
        }
        if (scenario === "deleted-user") {
          await ctx.db.patch(
            "users",
            user.userId,
            createDeletedUserTombstone(user.userId, Date.now())
          );
        }
        await messagesHandler(ctx, {
          id: messageId,
          operation: "insert",
          oldDoc: null,
          newDoc: message,
        });
      });
      expect(captureProductEvent).not.toHaveBeenCalled();
    }
  );
});
