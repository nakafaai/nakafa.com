import { saveMessages } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { createNinaTest } from "@repo/backend/test/nina";
import {
  deepestResult,
  levels,
  STORED_LEVELS,
} from "@repo/backend/test/nina/depth";
import { Array as Arr, Schema } from "effect";

/**
 * The most levels each capability's stored result may reach. Math is the one
 * that passes `STORED_LEVELS`, at 14 for the deepest card its schema admits and
 * 13 for a card with one step. The card nests `result`, then its list of
 * `steps`, then the expressions and `items` of each step, and `result` repeats
 * the request that the card already holds. Flattening it changes what
 * `evidence/math/result.tsx` and `marketing/about/nina/section.tsx` in
 * `apps/www` read and build, so it waits for the web round. Until then the
 * number below stops the card from growing. Delete the entry with the nesting.
 */
const bound = {
  deepResearch: STORED_LEVELS,
  math: 14,
  memory: STORED_LEVELS,
  nakafa: STORED_LEVELS,
};

describe("the results Nina stores for a capability", () => {
  it.each(LearningCapabilityNameSchema.literals)(
    "keep the message row of %s within the levels Convex warns above",
    async (capability) => {
      const f = await createNinaTest();
      const value = Schema.decodeUnknownSync(Schema.MutableJson)(
        deepestResult(capability)
      );
      // Agent stores a tool's result as a tool-result part of a tool message.
      const row = await f.t.mutation(async (ctx) => {
        const saved = await saveMessages(ctx, components.nina, {
          threadId: f.threadId,
          messages: [
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: "deepest",
                  toolName: capability,
                  output: { type: "json", value },
                },
              ],
            },
          ],
        });
        const [stored] = await ctx.runQuery(
          components.nina.messages.getMessagesByIds,
          { messageIds: Arr.map(saved.messages, (message) => message._id) }
        );
        return stored;
      });
      expect(levels(row)).toBeLessThanOrEqual(bound[capability]);
    },
    30_000
  );

  it.each(LearningCapabilityNameSchema.literals)(
    "keep the stream rows of %s within the same levels",
    async (capability) => {
      const f = await createNinaTest();
      const value = Schema.decodeUnknownSync(Schema.MutableJson)(
        deepestResult(capability)
      );
      // While a capability runs, each result it yields is a part of a delta.
      const delta = await f.t.mutation(async (ctx) => {
        const streamId = await ctx.runMutation(components.nina.streams.create, {
          threadId: f.threadId,
          order: 1,
          stepOrder: 1,
          format: "UIMessageChunk",
        });
        await ctx.runMutation(components.nina.streams.addDelta, {
          streamId,
          start: 0,
          end: 1,
          parts: [
            {
              type: "tool-output-available",
              toolCallId: "deepest",
              output: value,
              preliminary: true,
            },
          ],
        });
        const [stored] = await ctx.runQuery(
          components.nina.streams.listDeltas,
          { threadId: f.threadId, cursors: [{ streamId, cursor: 0 }] }
        );
        return stored;
      });
      expect(levels(delta)).toBeLessThanOrEqual(STORED_LEVELS);
    },
    30_000
  );
});
