import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { createNinaAgentContext } from "@repo/backend/confect/nina/contract/turn";
import { openHomeSession } from "@repo/backend/test/nina/specialist";
import { Effect } from "effect";

const runtime = { currentDate: "2026-09-27" };

describe("the context of a Nina turn", () => {
  it.effect(
    "says whether memory is on, and carries the role and the curriculum of the learner only when they have them",
    () =>
      Effect.gen(function* () {
        const session = yield* openHomeSession;
        const page = {
          locale: "en",
          needsFetch: false,
          nina: session.context,
          slug: "home",
          url: "https://nakafa.com/en/home",
          verified: false,
        } as const;
        const known = createNinaAgentContext({
          memory: true,
          page,
          runtime,
          user: {
            curriculumPreference: {
              program: {
                key: LearningProgramKeySchema.make("cambridge-lower-secondary"),
                title: "Cambridge Lower Secondary",
              },
            },
            role: "teacher",
          },
        });
        expect(known).toMatchObject({
          curriculumPreference: {
            program: { title: "Cambridge Lower Secondary" },
          },
          memory: true,
          slug: "home",
          url: "https://nakafa.com/en/home",
          userRole: "teacher",
        });
        const unknown = createNinaAgentContext({
          memory: false,
          page,
          runtime,
          user: {},
        });
        expect(unknown).toMatchObject({ memory: false, slug: "home" });
        expect(unknown).not.toHaveProperty("userRole");
        expect(unknown).not.toHaveProperty("curriculumPreference");
      })
  );
});
