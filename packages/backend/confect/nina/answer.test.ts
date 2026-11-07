import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { languageCeiling } from "@repo/backend/confect/spend/rates";
import { deployment, provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream, ninaUsage } from "@repo/backend/test/nina";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const fixture = () => createNinaTest({ prompt: "Explain a function limit." });

const run = Ref.getFunctionReference(refs.internal.nina.response.run);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("A Nina turn's spend", () => {
  it.effect(
    "holds the turn's model call against its learner's month and settles it to the reported bill",
    () =>
      Effect.gen(function* () {
        provider.languageModel.mockReturnValue(
          new MockLanguageModelV4({
            doStream: ninaStream([
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "answer" },
              { type: "text-delta", id: "answer", delta: "A metered answer." },
              { type: "text-end", id: "answer" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: "stop" },
                usage: ninaUsage,
                providerMetadata: { convexGateway: { cost: 0.0004 } },
              },
            ]),
          })
        );
        const f = yield* Effect.promise(() => fixture());
        yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
        const ledger = yield* Effect.promise(() =>
          f.t.run(async (ctx) => ({
            escrows: await ctx.db.query("vendorEscrows").collect(),
            rows: await ctx.db.query("vendorSpend").collect(),
          }))
        );
        expect(
          Arr.map(ledger.rows, ({ calls, held, payer, spent, vendor }) => ({
            calls,
            held,
            payer,
            spent,
            vendor,
          }))
        ).toEqual([
          {
            calls: 1,
            held: 0,
            payer: { kind: "learner", userId: f.identity.userId },
            spent: 400,
            vendor: "anthropic",
          },
        ]);
        expect(
          Arr.map(ledger.escrows, ({ held, state, work }) => ({
            held,
            state,
            work,
          }))
        ).toEqual([
          {
            held: languageCeiling("chat"),
            state: { spent: 400, status: "settled" },
            work: "chat",
          },
        ]);
      })
  );
});
