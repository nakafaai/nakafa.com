import { DatabaseReader } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Effect, Schema } from "effect";

describe("private chat ownership", () => {
  it("loads only the owner's chat and preserves typed missing and forbidden failures", async () => {
    const t = createConvexTestWithBetterAuth();
    const { owner, outsider, chatId } = await t.mutation(async (ctx) => {
      const owner = await seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "owner",
      });
      const outsider = await seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "outsider",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Private study",
        userId: owner.userId,
        type: "study",
        visibility: "private",
        updatedAt: Date.now(),
      });
      return {
        owner,
        outsider,
        chatId,
      };
    });
    expect(
      await t.query((ctx) =>
        Effect.runPromise(
          requireChatOwner(chatId, owner.userId).pipe(
            Effect.provide(DatabaseReader.layer(databaseSchema, ctx.db))
          )
        )
      )
    ).toMatchObject({
      _id: chatId,
      userId: owner.userId,
    });
    const forbidden = await t.query((ctx) =>
      Effect.runPromise(
        requireChatOwner(chatId, outsider.userId).pipe(
          Effect.flip,
          Effect.orDie,
          Effect.map(Schema.encodeSync(ChatAccessError)),
          Effect.provide(DatabaseReader.layer(databaseSchema, ctx.db))
        )
      )
    );
    expect(forbidden).toEqual({
      _tag: "ChatAccessError",
      code: "FORBIDDEN",
      message: "You do not have permission to modify this chat.",
    });
    await t.mutation((ctx) => ctx.db.delete("chats", chatId));
    const missing = await t.query((ctx) =>
      Effect.runPromise(
        requireChatOwner(chatId, owner.userId).pipe(
          Effect.flip,
          Effect.orDie,
          Effect.map(Schema.encodeSync(ChatAccessError)),
          Effect.provide(DatabaseReader.layer(databaseSchema, ctx.db))
        )
      )
    );
    const wire = {
      _tag: "ChatAccessError",
      code: "CHAT_NOT_FOUND",
      message: `Chat not found for chatId: ${chatId}`,
    };
    expect(missing).toEqual(wire);
    expect(
      Schema.decodeSync(ChatAccessError)({
        _tag: "ChatAccessError",
        code: "CHAT_NOT_FOUND",
        message: wire.message,
      })
    ).toBeInstanceOf(ChatAccessError);
  });
});
