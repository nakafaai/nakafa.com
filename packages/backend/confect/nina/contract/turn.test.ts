import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { createNinaAgentContext } from "@repo/backend/confect/nina/contract/turn";
import { homePage } from "@repo/backend/test/nina/page";

const runtime = { currentDate: "2026-09-27" };

describe("the context of a Nina turn", () => {
  it("says whether memory is on, and carries the role and the curriculum of the learner only when they have them", () => {
    const known = createNinaAgentContext({
      calendar: true,
      memory: true,
      page: homePage,
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
    expect(known).toEqual({
      currentDate: "2026-09-27",
      curriculumPreference: {
        program: {
          key: "cambridge-lower-secondary",
          title: "Cambridge Lower Secondary",
        },
      },
      memory: true,
      slug: "home",
      url: "https://nakafa.com/en/home",
      userRole: "teacher",
      verified: false,
    });
    const unknown = createNinaAgentContext({
      calendar: false,
      memory: false,
      page: homePage,
      runtime,
      user: {},
    });
    expect(unknown).toEqual({
      calendar: false,
      currentDate: "2026-09-27",
      memory: false,
      slug: "home",
      url: "https://nakafa.com/en/home",
      verified: false,
    });
  });
});
