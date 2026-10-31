import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaFocus } from "@repo/backend/confect/nina/contract/focus";
import {
  readQuestionFocus,
  resolveQuestionFocus,
  retainQuestionFocus,
} from "@repo/backend/confect/nina/focus";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import { createFocusTest } from "@repo/backend/test/nina/focus";
import { Exit } from "effect";

const readReference = Ref.getFunctionReference(refs.internal.nina.focus.read);
const OTHER_LEARNER_SEEDED_AT = Date.UTC(2026, 8, 27, 12);

describe("Nina question focus", () => {
  it("freezes a Pro learner's finished question", async () => {
    const f = await createFocusTest();
    await f.expectExit(
      resolveQuestionFocus(f.focus, f.identity.userId),
      (exit) => expect(exit).toEqual(Exit.succeed(f.frozen))
    );
  });

  it.each([
    "another learner",
    "an unfinished section",
    "the free plan",
    "a missing section",
    "a missing placement",
  ] as const)("rejects a question owned by %s", async (state) => {
    const f = await createFocusTest();
    await f.t.mutation(async (ctx) => {
      if (state === "another learner") {
        const other = await seedAuthenticatedUser(ctx, {
          now: OTHER_LEARNER_SEEDED_AT,
          suffix: "other",
        });
        await ctx.db.patch("tryoutAttempts", f.focus.attemptId, {
          userId: other.userId,
        });
      } else if (state === "an unfinished section") {
        await ctx.db.patch("tryoutSectionAttempts", f.seed.sectionId, {
          status: "in-progress",
        });
      } else if (state === "the free plan") {
        await ctx.db.patch("users", f.identity.userId, { plan: "free" });
      } else if (state === "a missing section") {
        await ctx.db.delete("tryoutSectionAttempts", f.seed.sectionId);
      } else {
        await ctx.db.delete("tryoutAttemptPlacements", f.focus.placementId);
      }
    });
    await f.expectExit(
      resolveQuestionFocus(f.focus, f.identity.userId),
      (exit) =>
        expect(exit).toMatchObject({
          _tag: "Failure",
          cause: {
            reasons: [
              {
                error: {
                  _tag: "NinaTurnError",
                  code: "NINA_CONTEXT_FAILED",
                },
              },
            ],
          },
        })
    );
  });

  it("keeps a conversation's question only while the review stays entitled", async () => {
    const f = await createFocusTest();
    const retain = (
      focus: NinaFocus | undefined,
      expected: NinaFocus | undefined
    ) =>
      f.expectExit(retainQuestionFocus(focus, f.identity.userId), (exit) =>
        expect(exit).toEqual(Exit.succeed(expected))
      );
    await retain(undefined, undefined);
    await retain(f.frozen, f.frozen);
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.identity.userId, { plan: "free" })
    );
    await retain(f.frozen, undefined);
  });

  it("reads the question, its explanation in the learner's locale, and how the answer graded", async () => {
    const f = await createFocusTest();
    const read = (check: (exit: Exit.Exit<unknown, unknown>) => void) =>
      f.expectExit(readQuestionFocus(f.frozen, f.identity.userId, "en"), check);
    await read((exit) =>
      expect(exit).toMatchObject({
        _tag: "Success",
        value: {
          answer: expect.any(String),
          explanation: expect.stringContaining(
            "Pembahasan section-a-item-1 en"
          ),
          question: expect.stringContaining("Soal section-a-item-1"),
          questionLanguage: "id",
          questionOrder: 1,
          result: "not answered",
        },
      })
    );
    for (const [grade, result] of [
      [{ category: 0, ceiling: 1, status: "scored" }, "answered incorrectly"],
      [{ category: 1, ceiling: 1, status: "scored" }, "answered correctly"],
      [{ ceiling: 1, status: "pending" }, "answered, awaiting grading"],
    ] as const) {
      await f.t.mutation(async (ctx) => {
        for (const stored of await ctx.db.query("tryoutResponses").collect()) {
          await ctx.db.delete("tryoutResponses", stored._id);
        }
        await ctx.db.insert("tryoutResponses", {
          answeredAt: 1,
          grade,
          placementId: f.focus.placementId,
          response: ["option-1"],
          timeSpent: 1,
          tryoutAttemptId: f.focus.attemptId,
          tryoutSectionAttemptId: f.seed.sectionId,
          updatedAt: 1,
          version: 1,
        });
      });
      await read((exit) =>
        expect(exit).toMatchObject({ _tag: "Success", value: { result } })
      );
    }
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.identity.userId, { plan: "free" })
    );
    await read((exit) => expect(exit).toEqual(Exit.succeed(null)));
  });

  it("reads an empty explanation when the learner's locale has none", async () => {
    const f = await createFocusTest();
    await f.t.mutation(async (ctx) => {
      const placement = await ctx.db.get(
        "tryoutAttemptPlacements",
        f.focus.placementId
      );
      if (!placement) {
        throw new Error("Expected the focused question.");
      }
      for (const row of await ctx.db
        .query("assessmentRows")
        .withIndex("by_kind_and_versionHash_and_language", (index) =>
          index
            .eq("kind", "explanation")
            .eq("versionHash", placement.versionHash)
            .eq("language", "en")
        )
        .collect()) {
        await ctx.db.delete("assessmentRows", row._id);
      }
    });
    await f.expectExit(
      readQuestionFocus(f.frozen, f.identity.userId, "en"),
      (exit) =>
        expect(exit).toMatchObject({
          _tag: "Success",
          value: { explanation: "", questionOrder: 1 },
        })
    );
  });

  it("fails closed when the snapshot lost the question's item version", async () => {
    const f = await createFocusTest();
    await f.t.mutation(async (ctx) => {
      const placement = await ctx.db.get(
        "tryoutAttemptPlacements",
        f.focus.placementId
      );
      if (!placement) {
        throw new Error("Expected the focused question.");
      }
      for (const row of await ctx.db
        .query("assessmentRows")
        .withIndex("by_kind_and_versionHash_and_language", (index) =>
          index.eq("kind", "item").eq("versionHash", placement.versionHash)
        )
        .collect()) {
        await ctx.db.delete("assessmentRows", row._id);
      }
    });
    await f.expectExit(
      readQuestionFocus(f.frozen, f.identity.userId, "en"),
      (exit) => expect(Exit.isFailure(exit)).toBe(true)
    );
  });

  it("serves generation only the focus stored on an existing turn", async () => {
    const f = await createFocusTest();
    const read = () => f.t.query(readReference, { turnId: f.turnId });
    expect(await read()).toBeNull();
    await f.focusTurn();
    expect(await read()).toMatchObject({
      explanation: expect.stringContaining("Pembahasan section-a-item-1"),
      question: expect.stringContaining("Soal section-a-item-1"),
    });
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    expect(await read()).toBeNull();
  });
});
