import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import ninaTurns from "@repo/backend/confect/_generated/tables/ninaTurns";
import type { NinaContextPack } from "@repo/backend/confect/nina/contract/pack";
import { readNinaLearningPage } from "@repo/backend/confect/nina/contract/turn";
import { readInstructions } from "@repo/backend/confect/nina/instructions";
import { createNinaTest } from "@repo/backend/test/nina";
import { createFocusTest } from "@repo/backend/test/nina/focus";
import { createMemoryTest } from "@repo/backend/test/nina/memory";
import { createPortraitTest } from "@repo/backend/test/nina/portrait";
import { sealedSummary } from "@repo/backend/test/seal";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { Effect, Schema } from "effect";

vi.mock("@repo/backend/agent/content", () => ({
  getNakafaContent: vi.fn(),
}));

const runtime = { currentDate: "2026-09-30T00:00:00.000Z" };
const NOW = Date.parse(runtime.currentDate);
const LESSON = "material:lesson:mathematics:material-section:limits";
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

/**
 * Reads one fixture turn's instructions, or the typed failure's reason. `tools`
 * changes what the turn's page allows, as a page that stored other permissions
 * would.
 */
async function instructionsFor(
  nina: Awaited<ReturnType<typeof createNinaTest>>,
  tools: Partial<NinaContextPack["tools"]> = {}
) {
  const turn = Schema.decodeUnknownSync(ninaTurns.Doc)(
    await nina.t.query((ctx) => ctx.db.get("ninaTurns", nina.turnId))
  );
  if (turn.phase !== "active") {
    throw new Error("Expected one active Nina turn.");
  }
  const { url } = readNinaLearningPage(turn.page);
  const page = {
    ...turn.page,
    nina: {
      ...turn.page.nina,
      tools: { ...turn.page.nina.tools, ...tools },
    },
  };
  return nina.t.action((ctx) =>
    Effect.runPromise(
      readInstructions({ ...turn, page }, url).pipe(
        Effect.map(
          ({ capabilities, instructions, memories, paused, summary }) => ({
            capabilities,
            instructions,
            memories: memories ?? null,
            paused,
            summary: summary?.throughOrder ?? null,
          })
        ),
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
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(
          ctx,
          f.identity.userId,
          "- The learner practiced limits."
        ),
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

  it("carries the learner's role, and leaves the facts of one turn to its message", async () => {
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
    expect(result).toHaveProperty(
      "instructions",
      expect.stringContaining("**User is a teacher.**")
    );
    for (const turnFact of [
      "Cambridge Lower Secondary",
      "https://nakafa.com/en/home",
      runtime.currentDate,
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.not.stringContaining(turnFact)
      );
    }
  });

  it("places the learner's account facts and portrait in the system prompt, and no memory", async () => {
    const f = await createPortraitTest();
    await f.t.mutation((ctx) =>
      ctx.db.insert("onboardingProfiles", {
        focus: "tryout",
        updatedAt: NOW,
        userId: f.identity.userId,
      })
    );
    await f.seed({ kind: "struggle", text: "Sulit di peluang." });
    await f.seedPortrait({ text: "Duduk di kelas 12 dan suka contoh soal." });
    const result = await instructionsFor(f);
    expect(result).toMatchObject({
      capabilities: ["nakafa", "deepResearch", "math", "memory"],
      paused: false,
    });
    for (const expected of [
      "# Learner",
      "- Focus: preparing for try-outs",
      "<portrait>\nDuduk di kelas 12 dan suka contoh soal.\n</portrait>",
      // Nina has the memory tool, so the policy tells her when to use it.
      "- memory: what the learner told Nina before, saved as their memories.",
      "## memory",
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.stringContaining(expected)
      );
    }
    // The memories are for the message, not for the prompt whose bytes are cached.
    expect(result).toHaveProperty(
      "instructions",
      expect.not.stringContaining("Sulit di peluang.")
    );
  });

  it("recalls the memories that fit the learner's message and the open page, for the message and not for the system prompt", async () => {
    const f = await createMemoryTest();
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 30),
      text: "Bingung limit.",
    });
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 1),
      text: "Suka matematika.",
      topics: ["path:subjects/mathematics"],
    });
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 29),
      text: "Tinggal di Bandung.",
    });
    await f.seed({
      confirmedAt: Date.UTC(2026, 8, 28),
      text: "Ikut SNBT 2027.",
    });
    await f.seed({ confirmedAt: Date.UTC(2026, 8, 27), text: "Kelas 12 IPA." });
    // The learner asks "Explain a limit.": the memory that holds the word is
    // recalled, and the two most recent others fill the list up to three.
    expect(await instructionsFor(f)).toHaveProperty(
      "memories",
      expect.stringContaining(
        "<memories>\n- Bingung limit. (2026-09-30)\n- Tinggal di Bandung. (2026-09-29)\n- Ikut SNBT 2027. (2026-09-28)\n</memories>"
      )
    );
    // On a page of mathematics the memory said there ranks first, and one
    // recent memory fills the list.
    await f.openLesson(
      `asset:en:${LESSON}`,
      "subjects/mathematics/limits/idea"
    );
    const open = await instructionsFor(f);
    expect(open).toHaveProperty(
      "memories",
      expect.stringContaining(
        "<memories>\n- Suka matematika. (2026-09-01)\n- Bingung limit. (2026-09-30)\n- Tinggal di Bandung. (2026-09-29)\n</memories>"
      )
    );
    expect(open).toHaveProperty(
      "instructions",
      expect.not.stringContaining("Bingung limit.")
    );
  });

  it("places no portrait, recalls no memory, and leaves out the memory tool while the learner has paused memory", async () => {
    const f = await createPortraitTest();
    await f.seed({ text: "Sulit di peluang." });
    await f.seedPortrait({ text: "Duduk di kelas 12." });
    await f.owner.mutation(pause, { paused: true });
    const result = await instructionsFor(f);
    // The prompt and the tools Nina is offered follow the one pause the turn read.
    expect(result).toMatchObject({
      capabilities: ["nakafa", "deepResearch", "math"],
      memories: null,
      paused: true,
    });
    for (const absent of [
      "Sulit di peluang.",
      "Duduk di kelas 12.",
      "- memory: what the learner told Nina before",
      "## memory",
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.not.stringContaining(absent)
      );
    }
  });

  it("leaves out a capability that the turn's page does not allow, with its rules, and keeps the others", async () => {
    const f = await createNinaTest();
    const result = await instructionsFor(f, { allowMath: false });
    // The prompt and the tools Nina is offered follow the page, as they follow the pause.
    expect(result).toMatchObject({
      capabilities: ["nakafa", "deepResearch", "memory"],
    });
    for (const absent of [
      "- math: deterministic calculations",
      "- math.given:",
      "## math",
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.not.stringContaining(absent)
      );
    }
    for (const present of [
      "- Nakafa: Nakafa-owned lessons",
      "## Nakafa",
      "## deepResearch",
      "## memory",
    ]) {
      expect(result).toHaveProperty(
        "instructions",
        expect.stringContaining(present)
      );
    }
  });

  it("recalls nothing for a learner who has no memory, and writes no heading", async () => {
    const f = await createMemoryTest();
    expect(await instructionsFor(f)).toHaveProperty("memories", null);
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
