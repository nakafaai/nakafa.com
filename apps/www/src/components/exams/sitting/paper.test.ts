import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { PaperView } from "@repo/backend/confect/exams/sittings/contract";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  changeSaved,
  mergePaper,
  nextVersionOf,
  type SavedValue,
  setSavedFlag,
  setSavedResponse,
} from "@/components/exams/sitting/paper";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));

/** One question of the server's paper, with a text entry. */
function question(
  id: string,
  number: number
): (typeof PaperView.Type)["questions"][number] {
  return {
    id: questionId(id),
    interactions: [{ id: `${id}-entry`, kind: "textEntry", label: "Answer" }],
    number,
  };
}

const paper: typeof PaperView.Type = {
  questions: [question("question-a", 1), question("question-b", 2)],
};

const saved: SavedValue = {
  answers: [
    { question: questionId("question-b"), response: ["b-1"], version: 4 },
  ],
  flagged: [],
};

describe("mergePaper", () => {
  it("keeps a question's object until its version or its flag moves, so an answer redraws one question", () => {
    const steady: typeof PaperView.Type = {
      questions: [question("steady-a", 1), question("steady-b", 2)],
    };
    const [firstA, firstB] = mergePaper(steady, saved).questions;
    const answered = setSavedResponse(
      saved,
      questionId("steady-b"),
      ["b-2"],
      1
    );
    const [secondA, secondB] = mergePaper(steady, answered).questions;
    const [thirdA] = mergePaper(
      steady,
      setSavedFlag(answered, questionId("steady-a"), true)
    ).questions;

    expect(secondA).toBe(firstA);
    expect(secondB).not.toBe(firstB);
    expect(thirdA).not.toBe(secondA);
  });

  it("gives each question of the paper the response, version, and flag that the student saved, and none to the others", () => {
    const merged = mergePaper(paper, {
      answers: saved.answers,
      flagged: [questionId("question-a")],
    });

    expect(merged.questions).toMatchObject([
      {
        flagged: true,
        id: questionId("question-a"),
        number: 1,
        response: null,
        version: null,
      },
      {
        flagged: false,
        id: questionId("question-b"),
        number: 2,
        response: ["b-1"],
        version: 4,
      },
    ]);
  });
});

describe("setSavedResponse", () => {
  it("saves a first response and replaces a saved one, numbered with the version it is sent with", () => {
    const first = setSavedResponse(saved, questionId("question-a"), ["a-1"], 1);
    const replaced = setSavedResponse(
      first,
      questionId("question-b"),
      ["b-2"],
      5
    );

    expect(mergePaper(paper, replaced).questions).toMatchObject([
      { response: ["a-1"], version: 1 },
      { response: ["b-2"], version: 5 },
    ]);
    expect(replaced.answers).toHaveLength(2);
  });
});

describe("setSavedFlag", () => {
  it("flags or unflags the question it names and leaves the others alone", () => {
    const flagged = setSavedFlag(saved, questionId("question-b"), true);
    const cleared = setSavedFlag(flagged, questionId("question-b"), false);

    expect(
      Arr.map(mergePaper(paper, flagged).questions, (item) => item.flagged)
    ).toEqual([false, true]);
    expect(
      Arr.map(mergePaper(paper, cleared).questions, (item) => item.flagged)
    ).toEqual([false, false]);
  });
});

describe("nextVersionOf", () => {
  it("numbers the first answer 1 and each later one above the saved version", () => {
    const [first, second] = mergePaper(paper, saved).questions;
    expect(nextVersionOf(first)).toBe(1);
    expect(nextVersionOf(second)).toBe(5);
  });
});

describe("changeSaved", () => {
  const key = {
    deviceId: "device-1",
    sittingId: Schema.decodeUnknownSync(Id("examSittings"))("sitting-a"),
    slug: Schema.decodeSync(TenantSlug)("sekolah"),
  };

  /** A local store that holds `current` for what the student saved, and records what is written to it. */
  const storeHolding = (current: Option.Option<SavedValue>) => {
    const getQuery = vi.fn();
    getQuery.mockReturnValue(current);
    const setQuery = vi.fn();
    return {
      localStore: { getAllQueries: vi.fn(), getQuery, setQuery },
      setQuery,
    };
  };

  it("writes what the student saved, changed, into the store that holds it, and never the paper", () => {
    const { localStore, setQuery } = storeHolding(Option.some(saved));

    changeSaved(localStore, key, (current) =>
      setSavedFlag(current, questionId("question-a"), true)
    );

    expect(setQuery).toHaveBeenCalledExactlyOnceWith(
      exams.sittings.saved,
      key,
      Option.some(setSavedFlag(saved, questionId("question-a"), true))
    );
  });

  it("writes nothing when the store holds nothing saved for the key", () => {
    const { localStore, setQuery } = storeHolding(Option.none());

    changeSaved(localStore, key, (current) => current);

    expect(setQuery).not.toHaveBeenCalled();
  });
});
