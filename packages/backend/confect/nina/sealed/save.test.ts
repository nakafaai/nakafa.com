import { createThread } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { isSealed } from "@repo/backend/confect/nina/sealed";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import {
  learnerWithKeyIn,
  messageFailureIn,
  readMessageIn,
  savePromptFailureIn,
  savePromptIn,
} from "@repo/backend/test/nina/sealed";
import { storedRowsIn, storedTextOf } from "@repo/backend/test/nina/stored";
import { createThreadTest } from "@repo/backend/test/nina/thread";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 8, 27, 12);
/** A string the tests plant in a learner's message, so one search finds any copy of it. */
const PLANT = "PLANT-SAVED-MESSAGE";

describe("saving a learner's message sealed", () => {
  it("writes the message sealed at the order after the newest message, and opens it for its learner", async () => {
    const f = await createThreadTest();
    const other = await learnerWithKeyIn(f.t, "other");
    const saved = await savePromptIn(f.t, f.identity.userId, {
      fileIds: [],
      message: { content: [{ text: PLANT, type: "text" }], role: "user" },
      threadId: f.identity.threadId,
    });
    expect(saved.message).toMatchObject({
      order: 1,
      status: "success",
      stepOrder: 0,
      text: PLANT,
      tool: false,
    });

    const rows = await storedRowsIn(f.t, f.identity.threadId, []);
    const [stored] = Arr.filter(
      rows.messages.page,
      (row) => row._id === saved.messageId
    );
    expect(stored && isSealed(stored)).toBe(true);
    expect(stored?.text).toBe("");
    expect(storedTextOf(rows)).not.toContain(PLANT);

    expect(
      await readMessageIn(f.t, f.identity.userId, saved.messageId)
    ).toMatchObject({ order: 1, text: PLANT });
    expect(await messageFailureIn(f.t, other, saved.messageId)).toBe(
      "VaultError"
    );
  });

  it("writes the first message of an empty thread at order 0 and step 0", async () => {
    const t = createConvexTestWithBetterAuth();
    const { threadId, userId } = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });
      const created = await createThread(ctx, components.nina, {
        userId: user.userId,
      });
      return { threadId: created, userId: user.userId };
    });

    const saved = await savePromptIn(t, userId, {
      fileIds: [],
      message: { content: "Halo.", role: "user" },
      threadId,
    });

    expect(saved.message).toMatchObject({
      order: 0,
      stepOrder: 0,
      text: "Halo.",
    });
  });

  it("refuses a message whose inline bytes only an action can store, and stores nothing", async () => {
    const f = await createThreadTest();
    const before = await storedRowsIn(f.t, f.identity.threadId, []);
    // The Agent stores an inline part above 64 KiB as a file, which needs an action.
    const failure = await savePromptFailureIn(f.t, f.identity.userId, {
      fileIds: [],
      message: {
        content: [
          {
            data: new ArrayBuffer(65 * 1024),
            mediaType: "application/pdf",
            type: "file",
          },
        ],
        role: "user",
      },
      threadId: f.identity.threadId,
    });

    expect(failure).toBe("SealedWriteError");
    const after = await storedRowsIn(f.t, f.identity.threadId, []);
    expect(after.messages.page).toHaveLength(before.messages.page.length);
  });
});
