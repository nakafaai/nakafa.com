import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  changePaper,
  nextVersionOf,
  type PaperQuestion,
  type PaperValue,
  setPaperFlag,
  setPaperResponse,
} from "@/components/exams/sitting/paper";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));

/** One question of a paper, with a text entry, the response it holds, and its version and flag. */
function question(
  id: string,
  response: readonly string[] | null,
  version: number | null = null
): PaperQuestion {
  return {
    flagged: false,
    id: questionId(id),
    interactions: [{ id: `${id}-entry`, kind: "textEntry", label: "Answer" }],
    number: 1,
    response,
    version,
  };
}

const paper: PaperValue = {
  questions: [question("question-a", null), question("question-b", ["b-1"], 4)],
};

describe("setPaperResponse", () => {
  it("replaces the response and the version of the question it names", () => {
    const changed = setPaperResponse(
      paper,
      questionId("question-a"),
      ["a-1"],
      1
    );

    expect(changed.questions).toMatchObject([
      { id: questionId("question-a"), response: ["a-1"], version: 1 },
      { id: questionId("question-b"), response: ["b-1"], version: 4 },
    ]);
  });
});

describe("setPaperFlag", () => {
  it("flags or unflags the question it names and leaves the others alone", () => {
    const flagged = setPaperFlag(paper, questionId("question-b"), true);
    const cleared = setPaperFlag(flagged, questionId("question-b"), false);

    expect(Arr.map(flagged.questions, (item) => item.flagged)).toEqual([
      false,
      true,
    ]);
    expect(Arr.map(cleared.questions, (item) => item.flagged)).toEqual([
      false,
      false,
    ]);
  });
});

describe("nextVersionOf", () => {
  it("numbers the first answer 1 and each later one above the saved version", () => {
    expect(nextVersionOf(question("question-a", null))).toBe(1);
    expect(nextVersionOf(question("question-b", ["b-1"], 4))).toBe(5);
  });
});

describe("changePaper", () => {
  const key = {
    deviceId: "device-1",
    sittingId: Schema.decodeUnknownSync(Id("examSittings"))("sitting-a"),
    slug: Schema.decodeSync(TenantSlug)("sekolah"),
  };

  /** A local store that holds `current` for the paper, and records what is written to it. */
  const storeHolding = (current: Option.Option<PaperValue>) => {
    const getQuery = vi.fn();
    getQuery.mockReturnValue(current);
    const setQuery = vi.fn();
    return {
      localStore: { getAllQueries: vi.fn(), getQuery, setQuery },
      setQuery,
    };
  };

  it("writes the changed paper of the student's key into the store that holds it", () => {
    const { localStore, setQuery } = storeHolding(Option.some(paper));

    changePaper(localStore, key, (current) =>
      setPaperFlag(current, questionId("question-a"), true)
    );

    expect(setQuery).toHaveBeenCalledExactlyOnceWith(
      exams.sittings.paper,
      key,
      Option.some(setPaperFlag(paper, questionId("question-a"), true))
    );
  });

  it("writes nothing when the store holds no paper for the key", () => {
    const { localStore, setQuery } = storeHolding(Option.none());

    changePaper(localStore, key, (current) => current);

    expect(setQuery).not.toHaveBeenCalled();
  });
});
