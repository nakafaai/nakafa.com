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
          now: Date.now(),
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

  it("reads the signed question, explanation and the learner's answer", async () => {
    const f = await createFocusTest();
    const read = (check: (exit: Exit.Exit<unknown, unknown>) => void) =>
      f.expectExit(readQuestionFocus(f.frozen, f.identity.userId, "en"), check);
    await read((exit) =>
      expect(exit).toEqual(
        Exit.succeed({
          questionOrder: f.frozen.questionOrder,
          questionLocale: "en",
          questionMdx: "## Technical question",
          explanationMdx: "#### Technical answer",
          responseSpec: expect.objectContaining({ kind: "single-choice" }),
          selection: null,
          outcome: null,
        })
      )
    );
    const selection = await f.t.mutation(async (ctx) => {
      const placement = await ctx.db.get(
        "tryoutAttemptPlacements",
        f.focus.placementId
      );
      if (placement?.responseSpec.kind !== "single-choice") {
        throw new Error("Expected one single-choice placement.");
      }
      const chosen = {
        kind: "single-choice" as const,
        optionKey: placement.responseSpec.options[0]?.optionKey ?? "",
      };
      await ctx.db.insert("tryoutResponses", {
        answeredAt: 1,
        isComplete: true,
        isCorrect: false,
        placementId: f.focus.placementId,
        selection: chosen,
        timeSpent: 1,
        tryoutAttemptId: f.focus.attemptId,
        tryoutSectionAttemptId: f.seed.sectionId,
        updatedAt: 1,
      });
      return chosen;
    });
    await read((exit) =>
      expect(exit).toMatchObject({
        _tag: "Success",
        value: { selection, outcome: { status: "incorrect" } },
      })
    );
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.identity.userId, { plan: "free" })
    );
    await read((exit) => expect(exit).toEqual(Exit.succeed(null)));
  });

  it.each(["missing", "moved"] as const)(
    "fails closed when a signed body is %s",
    async (state) => {
      const f = await createFocusTest();
      await f.t.mutation(async (ctx) => {
        const stored = await ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (index) =>
            index.eq(
              "artifactHash",
              f.seed.fixture.placement.questionArtifactHash
            )
          )
          .unique();
        if (!stored) {
          throw new Error("Expected one stored question body.");
        }
        if (state === "missing") {
          await ctx.db.delete("contentArtifacts", stored._id);
          return;
        }
        const artifact = JSON.parse(stored.artifactJson);
        await ctx.db.patch("contentArtifacts", stored._id, {
          artifactJson: JSON.stringify({
            ...artifact,
            artifactHash: f.seed.fixture.placement.answerArtifactHash,
          }),
        });
      });
      await f.expectExit(
        readQuestionFocus(f.frozen, f.identity.userId, "en"),
        (exit) => expect(Exit.isFailure(exit)).toBe(true)
      );
    }
  );

  it("serves generation only the focus stored on an existing turn", async () => {
    const f = await createFocusTest();
    const read = () => f.t.query(readReference, { turnId: f.turnId });
    expect(await read()).toBeNull();
    await f.focusTurn();
    expect(await read()).toMatchObject({
      questionMdx: "## Technical question",
      explanationMdx: "#### Technical answer",
    });
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    expect(await read()).toBeNull();
  });
});
