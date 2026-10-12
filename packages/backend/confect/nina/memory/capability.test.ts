import { Ref } from "@confect/core";
import { QueryRunner, RegisteredFunction } from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import type { Held } from "@repo/backend/confect/nina/capability/held";
import { memoryCapability } from "@repo/backend/confect/nina/memory/capability";
import {
  MEMORY_PAUSED,
  runMemory,
} from "@repo/backend/confect/nina/memory/tool";
import { GatewayTest } from "@repo/backend/test/gateway";
import type { createNinaTest } from "@repo/backend/test/nina";
import {
  finalAnswer,
  playTurn,
  toolCall,
} from "@repo/backend/test/nina/capability";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import {
  openHomeSession,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Effect, type Layer, MutableHashMap, MutableRef, Option } from "effect";

vi.mock("@repo/backend/confect/nina/memory/tool", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/memory/tool")>();
  return { ...actual, runMemory: vi.fn(actual.runMemory) };
});
afterEach(() => vi.restoreAllMocks());

const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

/**
 * Plays a model that searches the memories of the fixture's learner once, and
 * answers, in a turn whose context says that memory is on unless `memory` says
 * otherwise. `read` replaces how the search reads the learner's memories, to
 * make that read fail as the platform does. It returns what the turn produced
 * and the words the search left for the model's next step.
 */
async function search(
  f: Awaited<ReturnType<typeof createNinaTest>>,
  {
    memory = true,
    read,
  }: {
    readonly memory?: boolean;
    readonly read?: Layer.Layer<QueryRunner.QueryRunner>;
  } = {}
) {
  const found: Held = MutableHashMap.empty();
  const model = new MockLanguageModelV4({
    doGenerate: [toolCall("memory", { query: "snbt" }), finalAnswer],
  });
  const played = await f.t.action((ctx) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const session = yield* openHomeSession;
        const turn = playTurn({
          context: {
            ...specialistRequest.context,
            memory,
            nina: session.context,
          },
          held: found,
          model,
          prompt: "What do you remember about my exam?",
          registry: { memory: memoryCapability },
          userId: f.identity.userId,
        });
        return yield* read === undefined
          ? turn
          : turn.pipe(Effect.provide(read));
      }).pipe(
        Effect.provide([
          GatewayTest,
          RegisteredFunction.actionLayer(schema, ctx),
        ])
      )
    )
  );
  return { ...played, found };
}

describe("the memory capability in a turn", () => {
  it("hands the next step the memories that match its query, and leaves none of their words in the result the conversation stores", async () => {
    const f = await createMemoryTest();
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 1),
      text: "Mau ikut SNBT 2027",
    });
    await f.seed({ text: "Hobi main gitar" });
    const { found, logged, result } = await search(f);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("outcome");
    // The conversation stores one line, the note, and none of the words.
    expect(result[0]).toMatchObject({
      artifacts: [],
      text: expect.not.stringContaining("\n"),
    });
    expect(encodeJsonText(result)).not.toContain("SNBT");
    const words = Option.getOrThrow(
      MutableHashMap.get(found, {
        toolCallId: "capability",
        toolName: "memory",
      })
    );
    expect(words).toContain("- Mau ikut SNBT 2027 (2026-09-01)");
    expect(words).not.toContain("Hobi main gitar");
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("says that nothing was found, and marks the run as empty, for a learner who told Nina nothing", async () => {
    const f = await createMemoryTest();
    const { found, result } = await search(f);
    expect(result).toMatchObject([{ outcome: "empty" }]);
    expect(MutableHashMap.size(found)).toBe(0);
  });

  it("refuses a call under the policy of a turn whose memory is off, without reading any memory", async () => {
    vi.mocked(runMemory).mockClear();
    const f = await createMemoryTest();
    await f.seed({ text: "Mau ikut SNBT 2027" });
    const { found, logged, result } = await search(f, { memory: false });
    expect(result).toMatchObject([{ outcome: "denied" }]);
    expect(encodeJsonText(result)).toContain("Status: denied");
    expect(encodeJsonText(result)).not.toContain("Mau ikut SNBT 2027");
    expect(runMemory).not.toHaveBeenCalled();
    expect(MutableHashMap.size(found)).toBe(0);
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("refuses a call, with the same denial, when the learner paused memory after the turn began", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Mau ikut SNBT 2027" });
    await f.owner.mutation(pause, { paused: true });
    const { found, logged, result } = await search(f);
    expect(result).toMatchObject([{ outcome: "denied" }]);
    expect(encodeJsonText(result)).toContain("Status: denied");
    expect(encodeJsonText(result)).toContain(MEMORY_PAUSED.reason);
    expect(encodeJsonText(result)).not.toContain("Mau ikut SNBT 2027");
    expect(MutableHashMap.size(found)).toBe(0);
    expect(MutableRef.get(logged)).toEqual([]);
  });

  it("tells Nina it could not read memory, and keeps what the learner said out of the thread and the log, when the platform rejects the read", async () => {
    const f = await createMemoryTest();
    const { logged, result } = await search(f, {
      // The message of a rejected read may hold the learner's words.
      read: QueryRunner.layer(() =>
        Promise.reject(new Error("Lookup failed for Mau ikut SNBT 2027"))
      ),
    });
    expect(result).toMatchObject([{ outcome: "failed" }]);
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina capability failed",
        expect.objectContaining({ capability: "memory", phase: "read" }),
      ],
    ]);
    expect(encodeJsonText(result)).not.toContain("SNBT");
    expect(encodeJsonText(MutableRef.get(logged))).not.toContain("SNBT");
  });

  it("tells Nina it could not read memory, and keeps the message of a defect out of the thread and the log, when the run dies", async () => {
    vi.mocked(runMemory).mockReturnValueOnce(
      Effect.die(new Error("Private storage detail"))
    );
    const f = await createMemoryTest();
    const { errors, logged, result } = await search(f);
    expect(result).toMatchObject([{ outcome: "failed" }]);
    // The Agent would store the message of a tool error in the thread.
    expect(errors).toEqual([]);
    // The log tells a defect of the run from a read that failed by its phase.
    expect(MutableRef.get(logged)).toEqual([
      [
        "Nina capability failed",
        expect.objectContaining({ capability: "memory", phase: "run" }),
      ],
    ]);
    expect(encodeJsonText(result)).not.toContain("Private storage detail");
    expect(encodeJsonText(MutableRef.get(logged))).not.toContain(
      "Private storage detail"
    );
  });
});
