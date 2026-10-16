import { describe, expect, it } from "@effect/vitest";
import { languageModel, providerId } from "@repo/backend/confect/gateway/model";
import type { NinaUsageTotal } from "@repo/backend/confect/nina/contract/usage";
import { renderTable } from "@repo/backend/scripts/nina/table";
import type { ChatStep, GateTurn } from "@repo/backend/scripts/nina/verdict";
import { Array as Arr, Option } from "effect";

type Usage = typeof NinaUsageTotal.Type;

/** A row of the usage record as a call through the gateway handle leaves it. */
function usage(agent: Usage["agent"], fields: Partial<Usage> = {}): Usage {
  return {
    agent,
    calls: 1,
    input: 1000,
    model: languageModel.id,
    output: 100,
    provider: providerId,
    ...fields,
  };
}

/** A step of the chat agent, as the journal reports it. */
function step(cached: number, input: number): ChatStep {
  return { cached, finishReason: "stop", input, output: 100 };
}

const nina = usage("nina", {
  cached: 17_210,
  calls: 3,
  cost: 0.012_345,
  input: 21_034,
  output: 455,
  reasoning: 212,
});
const nakafa = usage("nakafa", {
  calls: 2,
  cost: 0.0012,
  input: 6120,
  output: 310,
});

/** A turn that took 31.5 seconds. */
const healthy = {
  order: 0,
  promptedAt: 1000,
  state: { finishedAt: 32_500, status: "complete" },
  suggestions: ["What is an exponent?"],
  usage: [nina, nakafa],
} satisfies GateTurn;

describe("the table of the release gate", () => {
  it("prints a row for each agent and a total, and the cache of each chat step, without any message text", () => {
    expect(renderTable(healthy, [step(0, 10_234), step(10_200, 10_890)])).toBe(
      Arr.join(
        [
          "agent   steps  input  cached  output  reasoning      cost  seconds",
          "nina        3  21034   17210     455        212  0.012345",
          "nakafa      2   6120       0     310          0  0.001200",
          "total       5  27154   17210     765        212  0.013545     31.5",
          "",
          "Cached of input tokens, by nina step: 0 of 10234, 10200 of 10890.",
        ],
        "\n"
      )
    );
  });

  it("says when the first step already read the cache", () => {
    const lines = renderTable(healthy, [
      step(9000, 9500),
      step(9000, 9800),
    ]).split("\n");

    expect(Option.getOrThrow(Arr.last(lines))).toBe(
      "Cached of input tokens, by nina step: 9000 of 9500, 9000 of 9800. The first step already read the cache, so a turn before this one with the same prompt prefix warmed it. Run the gate again after five minutes to see the turn's own cache."
    );
  });

  it("prints zero for the cached and reasoning counts an old row lacks, and a dash for a missing cost", () => {
    const old = usage("nina", { calls: 2, input: 800, output: 40 });

    expect(
      renderTable({ order: 0, state: healthy.state, usage: [old] }, [])
    ).toBe(
      Arr.join(
        [
          "agent  steps  input  cached  output  reasoning  cost  seconds",
          "nina       2    800       0      40          0     -",
          "total      2    800       0      40          0     -",
          "",
          "The Agent journal holds no step of the nina agent.",
        ],
        "\n"
      )
    );
  });

  it("prints a total even when the turn recorded nothing", () => {
    expect(
      renderTable({ ...healthy, usage: [] }, [
        step(0, 10_234),
        step(10_200, 10_890),
      ])
    ).toBe(
      Arr.join(
        [
          "agent  steps  input  cached  output  reasoning  cost  seconds",
          "total      0      0       0       0          0     -     31.5",
          "",
          "Cached of input tokens, by nina step: 0 of 10234, 10200 of 10890.",
        ],
        "\n"
      )
    );
  });
});
