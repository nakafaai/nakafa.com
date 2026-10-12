import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import { provider, textOf } from "@repo/backend/test/gateway";
import {
  answers,
  createCapturingTest,
  fails,
  level,
  MESSAGE,
  unavailable,
} from "@repo/backend/test/nina/capture";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import {
  Experimental_DecisionMockModelV4 as DecisionMockModel,
  MockLanguageModelV4,
} from "ai/test";
import { MutableRef, Record as Rec } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const NOW = Date.UTC(2026, 9, 10, 12);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  provider.decisionModel.mockReset();
  provider.languageModel.mockReset();
});

/** A decision the gateway cannot answer, with detail that must never reach a log. */
const unavailableError = new APICallError({
  isRetryable: false,
  message: "Private provider detail",
  requestBodyValues: { state: MESSAGE },
  statusCode: 503,
  url: "https://ai-gateway.convex.dev/alpha/decisions",
});

describe("memory capture that fails", () => {
  it("logs the provider's routing facts, never its words, and saves nothing", async () => {
    const f = await createCapturingTest();
    fails(() =>
      Promise.reject(
        new APICallError({
          message: "Private provider detail",
          requestBodyValues: { prompt: MESSAGE },
          statusCode: 400,
          isRetryable: false,
          url: "https://ai-gateway.convex.dev/v1/chat/completions",
        })
      )
    );
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({
        operation: "generate",
        reason: "invalid",
        rejected: false,
        status: 400,
      })
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain(
      "Private provider detail"
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain("Aku");
    expect(await f.stored()).toEqual([]);
  });

  it("logs the routing facts of a decision that cannot be made, never the message, asks the capture model nothing and saves nothing", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    provider.decisionModel.mockReturnValue(
      new DecisionMockModel({
        doDecide: () => Promise.reject(unavailableError),
      })
    );
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({
        operation: "judge",
        reason: "unavailable",
        rejected: false,
        status: 503,
      })
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain(
      "Private provider detail"
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain("Aku");
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.usage).toEqual([]);
  });

  it("saves nothing, and logs the same facts, when the decision about one of the candidates cannot be made, though the other candidate was judged", async () => {
    const f = await createCapturingTest();
    const goal = {
      kind: "goal",
      quote: "mau ikut SNBT 2027",
      text: "Ikut SNBT 2027.",
    } as const;
    answers(level, goal);
    // The message is judged lasting, the note of `level` is judged the
    // learner's own and holding nothing private, and the request about the
    // note of `goal` is refused.
    provider.decisionModel.mockReturnValue(
      new DecisionMockModel({
        doDecide: (request) =>
          textOf(request) === noteText(goal)
            ? Promise.reject(unavailableError)
            : Promise.resolve({
                answers: Rec.map(request.questions, (_, judgment) => ({
                  probability: judgment === "private" ? 0.01 : 0.99,
                  type: "boolean" as const,
                })),
                warnings: [],
              }),
      })
    );
    await f.capture();
    expect(await f.stored()).toEqual([]);
    expect((await f.turn())?.remembered).toBeUndefined();
    expect((await f.turn())?.usage).toEqual([
      expect.objectContaining({ agent: "memory", calls: 1 }),
    ]);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({
        operation: "judge",
        reason: "unavailable",
        rejected: false,
        status: 503,
      })
    );
    expect(encodeJsonText(MutableRef.get(f.logged))).not.toContain("Kelas 12.");
  });

  it("logs an answer with more than three memories as rejected, and saves none of them", async () => {
    const f = await createCapturingTest();
    answers(level, level, level, level);
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "generate", rejected: true })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs an answer that is not the asked object as rejected", async () => {
    const f = await createCapturingTest();
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: providerStep([{ type: "text", text: "not an object" }]),
      })
    );
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "generate", rejected: true })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs a prompt it cannot read", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    await f.capture("not-a-message-id");
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "read", rejected: false })
    );
  });

  it("logs a write that dies and saves nothing", async () => {
    const f = await createCapturingTest();
    answers(level);
    vi.stubEnv("VAULT_ROOT_KEYS", "");
    await f.capture();
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "unknown", rejected: false })
    );
    expect(await f.stored()).toEqual([]);
  });

  it("logs a memory it cannot open and changes nothing", async () => {
    const f = await createCapturingTest();
    const model = answers(level);
    await f.seed({ author: "learner" });
    await f.t.mutation(async (ctx) => {
      for (const key of await ctx.db.query("vaultKeys").collect()) {
        await ctx.db.delete(key._id);
      }
    });
    await f.capture();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(MutableRef.get(f.logged)).toEqual(
      unavailable({ operation: "unknown", rejected: false })
    );
    expect(await f.stored()).toHaveLength(1);
  });
});
