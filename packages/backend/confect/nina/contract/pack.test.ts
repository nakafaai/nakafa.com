import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import { Effect, Exit } from "effect";

const learning = {
  assetId: "asset:id:material:mathematics:vector:addition",
  contentId: "asset:id:material:mathematics:vector:addition",
  locale: "en",
  materialKey: "mathematics",
  section: "subject-lesson",
  slug: "subjects/mathematics/vector/addition",
  sourcePath: "material/lesson/mathematics/vector/addition",
  title: "Vector Addition",
  url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
  verified: true,
};
const placementProgramKey = LearningProgramKeySchema.make(
  "cambridge-lower-secondary"
);

describe("nina/contract/pack", () => {
  it.effect(
    "opens a verified page session with a durable snapshot and page-fetch policy",
    () =>
      Effect.gen(function* () {
        const session = yield* openNinaLearningSession({
          capturedAt: "2026-05-09T00:00:00.000Z",
          learning,
          placement: {
            mode: "placement",
            nodeKey: "curriculum:vector:addition",
            parentHref: "/en/curriculum/mathematics/vector",
            parentTitle: "Vector",
            programKey: placementProgramKey,
          },
          source: "current-page",
        });

        expect(session.context.snapshot).toMatchObject({
          capturedAt: "2026-05-09T00:00:00.000Z",
          learning,
          source: "current-page",
          tools: {
            allowPageFetch: true,
            evidenceScope: "verified-page",
          },
        });
        expect(session.context.transition).toEqual({
          reason: "page-context",
          toContextKey:
            "placement:cambridge-lower-secondary:curriculum:vector:addition:subjects/mathematics/vector/addition",
        });
      })
  );

  it.effect("keeps invalid session input in the Effect failure channel", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        openNinaLearningSession({
          capturedAt: "2026-05-09T00:00:00.000Z",
          learning: {
            ...learning,
            locale: "fr",
          },
          source: "current-page",
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect(
    "opens an unverified canonical session without current-page fetch permission",
    () =>
      Effect.gen(function* () {
        const session = yield* openNinaLearningSession({
          capturedAt: "2026-05-09T00:00:00.000Z",
          learning: {
            ...learning,
            verified: false,
          },
          source: "pinned-chat",
        });

        expect(session.context).not.toHaveProperty("placement");
        expect(session.context).not.toHaveProperty("focus");
        expect(session.context.snapshot.tools).toMatchObject({
          allowPageFetch: false,
          evidenceScope: "general-learning",
        });
        expect(session.context.transition).toEqual({
          reason: "same-context",
          toContextKey: "canonical:subjects/mathematics/vector/addition",
        });
      })
  );
});
