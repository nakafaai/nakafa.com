import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import {
  createNinaAgentContext,
  dropLegacyPage,
  NinaStoredPageSchema,
} from "@repo/backend/confect/nina/contract/turn";
import { oldPage } from "@repo/backend/test/nina/legacy";
import { homePage, lessonPage } from "@repo/backend/test/nina/page";
import { Effect, Option, Schema } from "effect";

const runtime = { currentDate: "2026-09-27" };

describe("the context of a Nina turn", () => {
  it("says whether memory is on, and carries the role and the curriculum of the learner only when they have them", () => {
    const known = createNinaAgentContext({
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
      memory: false,
      page: homePage,
      runtime,
      user: {},
    });
    expect(unknown).toEqual({
      currentDate: "2026-09-27",
      memory: false,
      slug: "home",
      url: "https://nakafa.com/en/home",
      verified: false,
    });
  });
});

describe("the page of a stored Nina turn", () => {
  for (const { name, page } of [
    { name: "the home route", page: homePage },
    { name: "a verified page with a placement", page: lessonPage },
  ]) {
    it.effect(
      `drops what only turns stored before the shape change hold, and nothing else, from ${name}`,
      () =>
        Effect.gen(function* () {
          expect(yield* dropLegacyPage(oldPage(page))).toEqual(page);
          expect(
            yield* dropLegacyPage(oldPage(page, { pinned: true }))
          ).toEqual(page);
        })
    );
  }

  it.effect("leaves the page of a turn written now as it is", () =>
    Effect.gen(function* () {
      expect(yield* dropLegacyPage(lessonPage)).toEqual(lessonPage);
    })
  );

  it("admits an object where an older turn holds a copy of its context or a marker, and no other value", () => {
    const admits = (page: unknown) =>
      Option.isSome(Schema.decodeUnknownOption(NinaStoredPageSchema)(page));
    const holding = (fields: Record<string, unknown>) => ({
      ...homePage,
      nina: { ...homePage.nina, ...fields },
    });

    expect(
      admits(
        holding({
          snapshot: { source: "current-page" },
          transition: { reason: "page-context" },
        })
      )
    ).toBe(true);
    expect(admits(holding({ snapshot: 42 }))).toBe(false);
    expect(admits(holding({ transition: "page-context" }))).toBe(false);
  });
});
