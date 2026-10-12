import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { createThread, saveMessages } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { readInput } from "@repo/backend/confect/nina/input";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { GatewayTest } from "@repo/backend/test/gateway";
import { type EarlierTurn, filler } from "@repo/backend/test/nina";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { sealedSummary } from "@repo/backend/test/seal";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Option } from "effect";

const NOW = Date.UTC(2026, 8, 27, 12);
const read = Ref.getFunctionReference(refs.internal.nina.summaries.read);

/** A model that answers the summary writer with `text`, and ends the way `finish` says. */
export function summaryModel(
  text: string,
  finish: Parameters<typeof providerStep>[1] = "stop"
) {
  return new MockLanguageModelV4({
    doGenerate: providerStep([{ type: "text", text }], finish),
  });
}

/** A model whose provider is down, so a fold fails. */
export function failingModel() {
  return new MockLanguageModelV4({
    doGenerate: () => Promise.reject(new Error("Provider down")),
  });
}

/**
 * `steps` tool steps of one turn. Nina says a few words before each call, as
 * she does while she works, so a test can tell a step from the answer.
 */
function toolSteps(order: number, steps: number) {
  return steps === 0
    ? []
    : Arr.flatMap(
        Arr.makeBy(steps, (step) => `call-${order}-${step}`),
        (toolCallId) => [
          {
            role: "assistant" as const,
            content: [
              { type: "text" as const, text: "Let me look it up" },
              {
                type: "tool-call" as const,
                toolCallId,
                toolName: "nakafa",
                input: {},
              },
            ],
          },
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId,
                toolName: "nakafa",
                output: { type: "text" as const, value: "Verified evidence" },
              },
            ],
          },
        ]
      );
}

/**
 * A chat whose Agent thread holds `turns` learner and Nina turns, each with
 * the settled turn row Nina stores, and what a test does with them: refresh
 * the summary as a turn settles, and read the model input of a turn. A
 * cancelled turn keeps the answer text it wrote before it stopped, and its
 * prompt is failed, as settlement leaves it. `shape` sets a turn's size with
 * `tokens`, which a fold counts, and gives it `steps` tool steps.
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
    let turnIds: NinaTurnsDoc["_id"][] = [];
    for (let order = 0; order < turns; order += 1) {
      const {
        cancelled = false,
        retryOf,
        steps = 0,
        tokens = 0,
      } = shape(order);
      const { messages } = await saveMessages(ctx, components.nina, {
        threadId,
        order,
        messages: [
          { role: "user", content: `Question ${retryOf ?? order}` },
          ...toolSteps(order, steps),
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
      const turnId = await ctx.db.insert("ninaTurns", {
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
      turnIds = Arr.append(turnIds, turnId);
    }
    return { chatId, prompts, threadId, turnIds, userId };
  });
  const settled = (order: number) => ({
    ...setup,
    order,
    promptMessageId: setup.prompts[order] ?? "",
  });
  const turnId = (order: number) =>
    Option.getOrThrow(Arr.get(setup.turnIds, order));
  // Refreshes the summary as the turn at `order` settles, optionally reading
  // another thread, and returns the arguments of the queries the refresh made.
  // The model call records its usage in the ledger of that turn.
  const refresh = (order: number, threadId = setup.threadId) =>
    t.action(async (ctx) => {
      const runQuery = vi.spyOn(ctx, "runQuery");
      await Effect.runPromise(
        createUsageHandler(turnId(order)).pipe(
          Effect.flatMap((usageHandler) =>
            refreshSummary({ ...settled(order), threadId }, usageHandler)
          ),
          Effect.provide([
            GatewayTest,
            RegisteredFunction.actionLayer(schema, ctx),
          ])
        )
      );
      return Arr.map(runQuery.mock.calls, ([, args]) => args);
    });
  // The row of the turn at `order`, with the ledger of its model calls.
  const turn = (order: number) =>
    t.query((ctx) => ctx.db.get("ninaTurns", turnId(order)));
  const summary = () =>
    t.query((ctx) => ctx.db.query("ninaSummaries").collect());
  // Stores the summary an earlier fold left, which covers the turns through
  // `throughOrder`. It is a row from before a fold recorded its tokens in the
  // ledger of its turn, so it holds the total of one call, which a refresh
  // leaves as it is.
  const seed = (throughOrder: number, text: string) =>
    t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: setup.chatId,
        text: await sealedSummary(ctx, setup.userId, text),
        throughOrder,
        updatedAt: NOW,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
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
  // The turns up to `settled` that are in neither the summary nor the model
  // input of the turn after it, whose questions are told by their text.
  const lost = async (settled: number) => {
    const through = (await stored())?.throughOrder ?? -1;
    const shown = encodeJsonText(await input(settled + 1));
    return Arr.filter(
      Arr.range(0, settled),
      (order) => order > through && !shown.includes(`"Question ${order}"`)
    );
  };
  return {
    ...setup,
    input,
    lost,
    refresh,
    seed,
    stored,
    summary,
    t,
    text,
    turn,
  };
}
