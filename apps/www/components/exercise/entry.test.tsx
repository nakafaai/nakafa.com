import type { ContentModule } from "@repo/contents/_lib/module";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnswerContent,
  ExerciseEntry,
  ExerciseTrackedEntry,
  QuestionContent,
} from "@/components/exercise/entry";
import { importContentModuleOrNull } from "@/lib/content/module";

interface MockExerciseArticleProps {
  answerContent: ReactNode;
  choices: readonly unknown[];
  exerciseNumber: number;
  id: string;
  questionContent: ReactNode;
  srLabel: string;
}

vi.mock("@/components/exercise/item/article", async () => {
  const React = await import("react");

  return {
    ExerciseArticle({
      answerContent,
      choices,
      exerciseNumber,
      id,
      questionContent,
      srLabel,
    }: MockExerciseArticleProps) {
      return React.createElement("article", {
        "data-choice-count": choices.length,
        "data-exercise-number": exerciseNumber,
        "data-has-answer": answerContent === null ? "false" : "true",
        "data-has-question": questionContent === null ? "false" : "true",
        "data-id": id,
        "data-sr-label": srLabel,
      });
    },
  };
});

vi.mock("@/components/exercise/item/analytics", async () => {
  const React = await import("react");

  return {
    QuestionAnalytics({
      articleId,
      exerciseNumber,
    }: {
      articleId: string;
      exerciseNumber: number;
    }) {
      return React.createElement("div", {
        "data-analytics-article-id": articleId,
        "data-analytics-exercise-number": exerciseNumber,
      });
    },
  };
});

vi.mock("@/lib/content/module", () => ({
  importContentModuleOrNull: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

/** Synthetic MDX component used by the exercise entry tests. */
function TestMdx() {
  return null;
}

const setPath = "exercises/high-school/snbt/general-reasoning/set-1";

const exercise = {
  choices: {
    en: [
      { label: "A", value: true },
      { label: "B", value: false },
    ],
    id: [
      { label: "A", value: true },
      { label: "B", value: false },
    ],
  },
  number: 2,
};

describe("exercise entry module content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the required question module", async () => {
    const module = { default: TestMdx } satisfies ContentModule;
    vi.mocked(importContentModuleOrNull).mockResolvedValue(module);

    const result = await QuestionContent({
      exerciseNumber: 2,
      locale: "id",
      setPath,
    });

    expect(result).toEqual(expect.objectContaining({ type: TestMdx }));
    expect(importContentModuleOrNull).toHaveBeenCalledWith({
      context: { exercise_number: 2 },
      filePath: `${setPath}/2/_question`,
      locale: "id",
      source: "exercise-question-module",
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it("keeps missing question modules as route-level 404s", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue(null);

    await expect(
      QuestionContent({
        exerciseNumber: 2,
        locale: "id",
        setPath,
      })
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("loads answer modules when authored", async () => {
    const module = { default: TestMdx } satisfies ContentModule;
    vi.mocked(importContentModuleOrNull).mockResolvedValue(module);

    const result = await AnswerContent({
      exerciseNumber: 2,
      locale: "id",
      setPath,
    });

    expect(result).toEqual(expect.objectContaining({ type: TestMdx }));
    expect(importContentModuleOrNull).toHaveBeenCalledWith({
      context: { exercise_number: 2 },
      filePath: `${setPath}/2/_answer`,
      locale: "id",
      source: "exercise-answer-module",
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it("keeps missing answer modules optional", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue(null);

    await expect(
      AnswerContent({
        exerciseNumber: 2,
        locale: "id",
        setPath,
      })
    ).resolves.toBeNull();

    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders the untracked exercise entry shell", () => {
    const html = renderToStaticMarkup(
      <ExerciseEntry
        exercise={exercise}
        locale="en"
        setPath={setPath}
        srLabel="Exercise 2"
      />
    );

    expect(html).toContain('data-exercise-number="2"');
    expect(html).toContain('data-id="exercise-2"');
    expect(html).toContain('data-choice-count="2"');
  });

  it("renders the tracked exercise entry shell with analytics", () => {
    const html = renderToStaticMarkup(
      <ExerciseTrackedEntry
        exercise={exercise}
        locale="en"
        setPath={setPath}
        srLabel="Exercise 2"
      />
    );

    expect(html).toContain('data-analytics-article-id="exercise-exercise-2"');
    expect(html).toContain('data-analytics-exercise-number="2"');
    expect(html).toContain('data-exercise-number="2"');
  });
});
