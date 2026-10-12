import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { createThread, saveMessages } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { readInput } from "@repo/backend/confect/nina/input";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { GatewayTest } from "@repo/backend/test/gateway";
import { type EarlierTurn, filler } from "@repo/backend/test/nina";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 8, 27, 12);
const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);

/**
 * A chat whose Agent thread holds `turns` learner and Nina turns, each with
 * the settled turn row Nina stores, and what a test does with them: refresh
 * the summary as a turn settles, and read the model input of a turn. A
 * cancelled turn keeps the answer text it wrote before it stopped, and its
 * prompt is failed, as settlement leaves it. `shape` sets a turn's size with
 * `tokens`, which a fold counts.
 */
export async function createSummaryTest(
  turns: number,
  shape: (order: number) => typeof EarlierTurn.Type = () => ({})
) {
  const t = createConvexTestWithBetterAuth();
  const setup = await t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, { now: NOW });
    const threadId = await createThread(ctx, components.nina, { userId });
    const chatId = await ctx.db.insert("chats", {
      userId,
      threadId,
      type: "study",
      visibility: "private",
      updatedAt: NOW,
    });
    let prompts: string[] = [];
    for (let order = 0; order < turns; order += 1) {
      const { cancelled = false, retryOf, tokens = 0 } = shape(order);
      const { messages } = await saveMessages(ctx, components.nina, {
        threadId,
        order,
        messages: [
          { role: "user", content: `Question ${retryOf ?? order}` },
          {
            role: "assistant",
            content: `Answer ${order}${tokens === 0 ? "" : ` ${filler(tokens)}`}`,
          },
        ],
      });
      const promptMessageId = messages[0]?._id ?? "";
      prompts = Arr.append(prompts, promptMessageId);
      if (cancelled) {
        await ctx.runMutation(components.nina.messages.updateMessage, {
          messageId: promptMessageId,
          patch: { status: "failed", error: "cancelled" },
        });
      }
      await ctx.db.insert("ninaTurns", {
        chatId,
        order,
        phase: "settled",
        promptMessageId,
        state: cancelled
          ? { status: "cancelled", finishedAt: NOW }
          : { status: "complete", finishedAt: NOW },
        threadId,
        usage: [],
        userId,
        ...(retryOf === undefined ? {} : { retryOf }),
      });
    }
    return { chatId, prompts, threadId, userId };
  });
  const settled = (order: number) => ({
    ...setup,
    order,
    promptMessageId: setup.prompts[order] ?? "",
  });
  // Refreshes the summary as the turn at `order` settles, optionally reading
  // another thread, and returns the arguments of the queries the refresh made.
  const refresh = (order: number, threadId = setup.threadId) =>
    t.action(async (ctx) => {
      const runQuery = vi.spyOn(ctx, "runQuery");
      await Effect.runPromise(
        refreshSummary({ ...settled(order), threadId }).pipe(
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      );
      return Arr.map(runQuery.mock.calls, ([, args]) => args);
    });
  const summary = () =>
    t.query((ctx) => ctx.db.query("ninaSummaries").collect());
  // The stored text is sealed, so the tests read it the way generation does.
  const stored = () => t.query(read, { chatId: setup.chatId });
  const text = async () => (await stored())?.text;
  // What the model receives for the turn at `order`, whose question the chat
  // holds, through the summary as it stands.
  const input = async (order: number) => {
    const through = (await stored())?.throughOrder ?? null;
    return t.action((ctx) =>
      Effect.runPromise(
        readInput(settled(order), { context: "", through }).pipe(
          Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
        )
      )
    );
  };
  return {
    ...setup,
    input,
    now: NOW,
    refresh,
    settled,
    stored,
    summary,
    t,
    text,
  };
}
