import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import {
  decodeAttemptBodies,
  projectSectionAttempt,
  projectSetAttempt,
  sectionAttemptRequest,
  setAttemptRequest,
} from "@/components/tryout/route/learner";
import { makeTryoutBody } from "@/test/tryout";

const keys = {
  countryKey: "indonesia",
  examKey: "snbt",
  setKey: "set-1",
  trackKey: "2027",
};
const SET = "try-out/indonesia/snbt/2027/set-1";
const { placementId, versionHash, ...body } = makeTryoutBody("question-1");
const content = [{ body: encodeJsonText(body), placementId, versionHash }];

describe("the request of a learner's URL", () => {
  it("asks for the attempt the URL names, or else the learner's current one", () => {
    expect(
      setAttemptRequest({
        attemptId: undefined,
        keys,
        locale: "en",
        publicPath: SET,
      })
    ).toEqual({ ...keys, kind: "current", locale: "en" });
    expect(
      setAttemptRequest({
        attemptId: "attempt-1",
        keys,
        locale: "en",
        publicPath: SET,
      })
    ).toEqual({
      attemptId: "attempt-1",
      kind: "retained",
      locale: "en",
      publicPath: SET,
    });
    expect(
      sectionAttemptRequest({
        attemptId: undefined,
        keys,
        locale: "id",
        publicPath: `${SET}/verbal`,
        sectionKey: "verbal",
      })
    ).toEqual({ ...keys, kind: "current", locale: "id", sectionKey: "verbal" });
    expect(
      sectionAttemptRequest({
        attemptId: "attempt-1",
        keys,
        locale: "id",
        publicPath: `${SET}/verbal`,
        sectionKey: "verbal",
      })
    ).toEqual({
      attemptId: "attempt-1",
      kind: "retained",
      locale: "id",
      publicPath: `${SET}/verbal`,
    });
  });
});

describe("decodeAttemptBodies", () => {
  it.effect(
    "decodes the bodies a page read carries, and none when it carries none",
    () =>
      Effect.gen(function* () {
        expect(yield* decodeAttemptBodies(content)).toEqual([
          makeTryoutBody("question-1"),
        ]);
        expect(yield* decodeAttemptBodies([])).toBeNull();
      })
  );
});

describe("projectSetAttempt", () => {
  /** A set page read of `kind` with a page of its own. */
  const answerOf = (kind: "current" | "retained") =>
    ({
      attemptId: "attempt-1",
      initialState: { attempt: { status: "in-progress" }, runtime: null },
      kind,
      page: { sections: [{ publicPath: `${SET}/verbal` }], set: "running" },
      restartTarget: null,
    }) as const;

  it("binds a running attempt with the running page in place of the catalog's", () => {
    expect(
      projectSetAttempt({
        answer: answerOf("retained"),
        catalogPage: { set: "catalog" },
        mode: "single",
      })
    ).toEqual({
      binding: {
        attemptId: "attempt-1",
        initialState: { attempt: { status: "in-progress" }, runtime: null },
        mode: "single",
        sectionRoutes: [{ publicPath: `${SET}/verbal` }],
      },
      page: { sections: [{ publicPath: `${SET}/verbal` }], set: "running" },
      restartTarget: null,
    });
  });

  it("keeps the catalog page for a current attempt", () => {
    expect(
      projectSetAttempt({
        answer: answerOf("current"),
        catalogPage: { set: "catalog" },
        mode: "list",
      }).page
    ).toEqual({ set: "catalog" });
  });
});

describe("projectSectionAttempt", () => {
  it("binds the section's attempt with the start link of its section and the set it returns to", () => {
    expect(
      projectSectionAttempt({
        answer: {
          activeSectionPublicPath: `${SET}/verbal`,
          activeSetPublicPath: SET,
          attemptId: "attempt-1",
          initialState: { attempt: { status: "in-progress" } },
          kind: "retained",
          page: { section: "verbal" },
        } as const,
        mode: "list",
        setPath: SET,
      })
    ).toEqual({
      binding: {
        attemptId: "attempt-1",
        initialState: { attempt: { status: "in-progress" } },
        mode: "list",
        startPath: `${SET}/verbal`,
      },
      page: { section: "verbal" },
      setPath: SET,
    });
  });

  it("binds no start link when the attempt runs no section", () => {
    expect(
      projectSectionAttempt({
        answer: {
          activeSectionPublicPath: null,
          activeSetPublicPath: null,
          attemptId: "attempt-1",
          initialState: { attempt: { status: "completed" } },
          kind: "retained",
          page: { section: "verbal" },
        } as const,
        mode: "list",
        setPath: SET,
      }).binding.startPath
    ).toBeNull();
  });
});
