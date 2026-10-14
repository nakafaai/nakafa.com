import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import {
  NinaContextPackSchema,
  openNinaLearningSession,
} from "@repo/backend/confect/nina/contract/pack";
import { Effect, Exit, Schema } from "effect";

const learning = {
  assetId: "asset:id:material:mathematics:vector:addition",
  locale: "en",
  materialKey: "mathematics",
  section: "subject-lesson",
  slug: "subjects/mathematics/vector/addition",
  sourcePath: "material/lesson/mathematics/vector/addition",
  title: "Vector Addition",
  url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
  verified: true,
};
const placement = {
  mode: "placement",
  nodeKey: "curriculum:vector:addition",
  parentHref: "/en/curriculum/mathematics/vector",
  parentTitle: "Vector",
  programKey: LearningProgramKeySchema.make("cambridge-lower-secondary"),
};

describe("nina/contract/pack", () => {
  it.effect(
    "opens a verified page session that holds the page, its placement and the page-fetch policy, and no other copy of them",
    () =>
      Effect.gen(function* () {
        const session = yield* openNinaLearningSession({
          learning,
          placement,
        });

        // The whole pack is compared, so any field beside these would fail it.
        expect(session).toEqual({
          context: {
            learning,
            placement,
            tools: { allowPageFetch: true, evidenceScope: "verified-page" },
          },
        });
      })
  );

  it.effect("keeps invalid session input in the Effect failure channel", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        openNinaLearningSession({
          learning: {
            ...learning,
            locale: "fr",
          },
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
          learning: {
            ...learning,
            verified: false,
          },
        });

        expect(session.context).not.toHaveProperty("placement");
        expect(session.context).not.toHaveProperty("focus");
        expect(
          yield* Schema.decodeEffect(NinaContextPackSchema)(session.context)
        ).toEqual(session.context);
        expect(session.context.tools).toEqual({
          allowPageFetch: false,
          evidenceScope: "general-learning",
        });
      })
  );
});
