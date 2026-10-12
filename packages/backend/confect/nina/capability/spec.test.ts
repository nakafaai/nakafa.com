import { saveMessages } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  type LearningCapabilityName,
  LearningCapabilityNameSchema,
} from "@repo/backend/confect/nina/capability/spec";
import { createNinaTest } from "@repo/backend/test/nina";
import {
  deepestResult,
  levels,
  STORED_LEVELS,
} from "@repo/backend/test/nina/depth";
import { Array as Arr, Schema } from "effect";

/**
 * The capabilities whose stored result may still pass `STORED_LEVELS`, with the
 * levels the message row of their deepest card reaches today. Math is the only
 * one. Below the row, its card nests `message`, `content`, a part, `output` and
 * `value`, and then `artifacts`, an artifact, `data`, `result`, `steps`, a step,
 * its `items` and an item: 14 levels for the deepest card its schema admits. A
 * card with one step and no items is 13, the depth at which production logged
 * Convex's warning on 12 October 2026. The other capabilities measure 12 for
 * Nakafa retrieval, 11 for research and 7 for memory.
 *
 * Flattening the card changes the stored shape that the page decodes with
 * `CapabilityOutputSchema`, so the rollout contract of
 * `packages/backend/AGENTS.md` orders it: first the schema accepts both shapes
 * and a web build that reads both is served, then the writer stores the flat
 * one. That is a change of the web round, and nothing here may run ahead of it.
 *
 * Until then the entry stops the card from growing, and the test fails once the
 * card fits the bound, so the exception cannot outlive its cause. Owner: the
 * Nina program. Exit: math measures at most `STORED_LEVELS`. Cleanup: delete
 * this table and the branch that reads it.
 */
const above: Partial<Record<LearningCapabilityName, number>> = { math: 14 };

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
      const reached = levels(row);
      const exception = above[capability];
      if (exception === undefined) {
        expect(reached).toBeLessThanOrEqual(STORED_LEVELS);
        return;
      }
      expect(
        reached,
        `${capability} fits ${STORED_LEVELS} levels now: delete its entry in "above"`
      ).toBeGreaterThan(STORED_LEVELS);
      expect(
        reached,
        `${capability} grew past the levels its card reached`
      ).toBeLessThanOrEqual(exception);
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
