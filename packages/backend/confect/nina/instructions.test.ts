import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import ninaTurns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { createNinaAgentContext } from "@repo/backend/confect/nina/contract/turn";
import { readInstructions } from "@repo/backend/confect/nina/instructions";
import { MEMORY_PROMPT_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { createNinaTest } from "@repo/backend/test/nina";
import { createFocusTest } from "@repo/backend/test/nina/focus";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { Effect, Schema } from "effect";

vi.mock("@repo/backend/agent/content", () => ({
  getNakafaContent: vi.fn(),
}));

const runtime = { currentDate: "2026-09-30T00:00:00.000Z" };
const NOW = Date.parse(runtime.currentDate);
const LESSON = "material:lesson:mathematics:material-section:limits";
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

/** Reads one fixture turn's instructions, or the typed failure's reason. */
async function instructionsFor(
  nina: Awaited<ReturnType<typeof createNinaTest>>
) {
  const turn = Schema.decodeUnknownSync(ninaTurns.Doc)(
    await nina.t.query((ctx) => ctx.db.get("ninaTurns", nina.turnId))
  );
  if (turn.phase !== "active") {
    throw new Error("Expected one active Nina turn.");
  }
  const { url } = createNinaAgentContext({
    page: turn.page,
    runtime,
    user: turn.user,
  });
  return nina.t.action((ctx) =>
    Effect.runPromise(
      readInstructions(turn, url, runtime).pipe(
        Effect.map(({ instructions, summary }) => ({
          instructions,
          summary: summary?.throughOrder ?? null,
        })),
        Effect.catchTag("NinaGenerationError", (error) =>
          Effect.succeed({ failure: error.reason })
        ),
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    )
  );
}

describe("Nina instructions", () => {
  it("places the verified current page and the conversation summary", async () => {
    vi.mocked(getNakafaContent).mockReturnValue(
      Effect.succeedSome({
        ...readNakafaContentRefFixture("en", "home", "material"),
        text: "## Limits\n\nA limit describes the value a function approaches.",
        title: "Limits",
      })
    );
    const f = await createNinaTest({ needsFetch: true });
    await f.t.mutation((ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: "- The learner practiced limits.",
        throughOrder: 3,
        updatedAt: NOW,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    const result = await instructionsFor(f);
    expect(result).toMatchObject({ summary: 3 });
    expect(result).toHaveProperty(
      "instructions",
      expect.stringContaining(
        "A limit describes the value a function approaches."
      )
    );
    expect(result).toHaveProperty(
      "instructions",
      expect.stringContaining("- The learner practiced limits.")
    );
  });

  it("carries the learner's role and curriculum preference", async () => {
    const f = await createNinaTest();
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", f.turnId, {
        user: {
          role: "teacher",
          curriculumPreference: {
            program: {
              key: "cambridge-lower-secondary",
              title: "Cambridge Lower Secondary",
            },
          },
        },
      })
    );
    const result = await instructionsFor(f);
    for (const expected of ["Cambridge Lower Secondary", "teacher"]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.stringContaining(expected)
      );
    }
  });

  it("places the learner's account facts and the memories chosen for the turn", async () => {
    const f = await createMemoryTest();
    await f.t.mutation((ctx) =>
      ctx.db.insert("onboardingProfiles", {
        focus: "tryout",
        updatedAt: NOW,
        userId: f.identity.userId,
      })
    );
    await f.seed({ kind: "struggle", text: "Sulit di peluang." });
    await f.seed({ author: "learner", text: "Kelas 12 IPA." });
    const result = await instructionsFor(f);
    for (const expected of [
      "# Learner",
      "- Focus: preparing for try-outs",
      "<memories>\n- Kelas 12 IPA.\n- (struggle) Sulit di peluang.\n</memories>",
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.stringContaining(expected)
      );
    }
  });

  it("puts the memories about the lesson the learner has open ahead of newer ones", async () => {
    const f = await createMemoryTest();
    await f.fill(MEMORY_PROMPT_LIMIT);
    await f.seed({ confirmedAt: 0, lesson: LESSON, text: "Bingung limit." });
    expect(await instructionsFor(f)).toHaveProperty(
      "instructions",
      expect.not.stringContaining("Bingung limit.")
    );
    await f.openLesson(`asset:en:${LESSON}`);
    const open = await instructionsFor(f);
    expect(open).toHaveProperty(
      "instructions",
      expect.stringContaining("- (goal) Bingung limit.")
    );
    expect(open).toHaveProperty(
      "instructions",
      expect.not.stringContaining("- (goal) Memory 0\n")
    );
  });

  it("places no memory while the learner has paused memory", async () => {
    const f = await createMemoryTest();
    await f.seed({ text: "Sulit di peluang." });
    await f.owner.mutation(pause, { paused: true });
    const result = await instructionsFor(f);
    expect(result).toHaveProperty(
      "instructions",
      expect.not.stringContaining("Sulit di peluang.")
    );
  });

  it("reads a focused question from its signed body and official explanation", async () => {
    const f = await createFocusTest();
    await f.focusTurn();
    const result = await instructionsFor(f);
    expect(result).toMatchObject({ summary: null });
    for (const expected of [
      "# Focused Try-out Question",
      "Technical question",
      "Technical answer",
      "# Focused Question Instructions",
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.stringContaining(expected)
      );
    }
  });

  it("fails a focused turn whose question is no longer entitled", async () => {
    const f = await createFocusTest();
    await f.focusTurn();
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.identity.userId, { plan: "free" })
    );
    expect(await instructionsFor(f)).toEqual({ failure: "unknown" });
  });
});
