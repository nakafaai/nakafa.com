import { describe, expect, it } from "@effect/vitest";
import { escrowed } from "@repo/backend/confect/gateway/escrow";
import {
  languageCeiling,
  languageCost,
  reportedCost,
} from "@repo/backend/confect/spend/rates";
import { recordingMeter } from "@repo/backend/test/spend";
import { wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const prompt = [
  { role: "user" as const, content: [{ type: "text" as const, text: "Hi" }] },
];
const usage = {
  inputTokens: { total: 10_000, noCache: 10_000, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1000, text: 1000, reasoning: 0 },
};
const unreported = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};
const finishReason = { unified: "stop" as const, raw: "stop" };
const CHAT = languageCeiling("chat");

/** A chat model over one mock provider model, metered by a recording meter. */
function meteredModel(
  provider: ConstructorParameters<typeof MockLanguageModelV4>[0],
  refuse = false
) {
  const meter = recordingMeter(refuse);
  const mock = new MockLanguageModelV4(provider);
  const model = wrapLanguageModel({
    model: mock,
    middleware: escrowed(meter.service, "chat"),
  });
  return { meter, mock, model };
}

/** Reads a stream to its end, dropping every part. */
function drain(stream: ReadableStream<unknown>) {
  return stream.pipeTo(new WritableStream());
}

/** A stream of the given parts. */
function streamOf(parts: readonly unknown[]) {
  return new ReadableStream({
    start: (controller) => {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

describe("gateway/escrow", () => {
  it("settles a generated answer to the cost the gateway reported", async () => {
    const { meter, model } = meteredModel({
      doGenerate: {
        content: [{ type: "text", text: "Hello" }],
        finishReason,
        providerMetadata: { convexGateway: { cost: 0.001_25 } },
        usage,
        warnings: [],
      },
    });
    await model.doGenerate({ prompt });
    expect(meter.calls()).toEqual([
      `hold chat ${CHAT}`,
      `settle ${reportedCost(0.001_25)}`,
    ]);
  });

  it("settles an answer with no reported cost to its tokens at the public rates", async () => {
    const { meter, model } = meteredModel({
      doGenerate: {
        content: [{ type: "text", text: "Hello" }],
        finishReason,
        usage,
        warnings: [],
      },
    });
    await model.doGenerate({ prompt });
    expect(meter.calls()).toEqual([
      `hold chat ${CHAT}`,
      `settle ${languageCost({ input: 10_000, output: 1000, cacheRead: 0, cacheWrite: 0 })}`,
    ]);
  });

  it("settles an answer that reports no tokens to its whole hold", async () => {
    const { meter, model } = meteredModel({
      doGenerate: {
        content: [{ type: "text", text: "Hello" }],
        finishReason,
        usage: unreported,
        warnings: [],
      },
    });
    await model.doGenerate({ prompt });
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`, `settle ${CHAT}`]);
  });

  it("settles a failed call to its whole hold and passes its error on", async () => {
    const failure = new Error("provider down");
    const { meter, model } = meteredModel({
      doGenerate: () => Promise.reject(failure),
    });
    await expect(model.doGenerate({ prompt })).rejects.toBe(failure);
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`, `settle ${CHAT}`]);
  });

  it("refuses a call the budget cannot hold before the provider is asked", async () => {
    const { mock, model } = meteredModel(
      {
        doGenerate: {
          content: [],
          finishReason,
          usage,
          warnings: [],
        },
      },
      true
    );
    await expect(model.doGenerate({ prompt })).rejects.toMatchObject({
      _tag: "SpendRefused",
    });
    await expect(model.doStream({ prompt })).rejects.toMatchObject({
      _tag: "SpendRefused",
    });
    expect(mock.doGenerateCalls).toEqual([]);
    expect(mock.doStreamCalls).toEqual([]);
  });

  it("settles a stream to the cost of its finish part when it ends", async () => {
    const { meter, model } = meteredModel({
      doStream: {
        stream: streamOf([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "Hello" },
          { type: "text-end", id: "1" },
          {
            type: "finish",
            finishReason,
            providerMetadata: { convexGateway: { cost: 0.002 } },
            usage,
          },
        ]),
      },
    });
    const { stream } = await model.doStream({ prompt });
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`]);
    await drain(stream);
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`, "settle 2000"]);
  });

  it("settles a stream that ends with no finish part to its whole hold", async () => {
    const { meter, model } = meteredModel({
      doStream: { stream: streamOf([{ type: "text-start", id: "1" }]) },
    });
    const { stream } = await model.doStream({ prompt });
    await drain(stream);
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`, `settle ${CHAT}`]);
  });

  it("settles a cancelled stream to its whole hold", async () => {
    const { meter, model } = meteredModel({
      doStream: { stream: new ReadableStream() },
    });
    const { stream } = await model.doStream({ prompt });
    await stream.cancel();
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`, `settle ${CHAT}`]);
  });

  it("settles a stream that never opened to its whole hold and passes its error on", async () => {
    const failure = new Error("no stream");
    const { meter, model } = meteredModel({
      doStream: () => Promise.reject(failure),
    });
    await expect(model.doStream({ prompt })).rejects.toBe(failure);
    expect(meter.calls()).toEqual([`hold chat ${CHAT}`, `settle ${CHAT}`]);
  });
});
