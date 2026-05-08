import { fetchExercises } from "@repo/ai/agents/content/tools/material/exercises";
import type { RouteParams } from "@repo/ai/agents/content/tools/material/types";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  getCurrentMaterial,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises/set";
import { ExerciseLoadError } from "@repo/contents/_shared/error";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/exercises/material", () => ({
  getCurrentMaterial: vi.fn(),
  getMaterials: vi.fn(),
}));

vi.mock("@repo/contents/_lib/exercises/set", () => ({
  getExerciseByNumber: vi.fn(),
  getExercisesContent: vi.fn(),
}));

const exercise = {
  number: 1,
  question: {
    metadata: {
      title: "Question",
      authors: [{ name: "Nakafa" }],
      date: "05/08/2026",
    },
    default: undefined,
    raw: "What is 1 + 1?",
  },
  answer: {
    metadata: {
      title: "Answer",
      authors: [{ name: "Nakafa" }],
      date: "05/08/2026",
    },
    default: undefined,
    raw: "The answer is 2.",
  },
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
};

/**
 * Creates a test writer that records AI SDK UI message stream parts.
 */
function createWriter() {
  const parts: Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0][] =
    [];
  const writer = {
    onError: undefined,
    merge(stream) {
      stream.getReader().releaseLock();
    },
    write(part) {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

/**
 * Creates the shared fetch input for one exercise content route.
 */
function createParams(
  cleanedSlug: string,
  writer: UIMessageStreamWriter<MyUIMessage>
) {
  return {
    cleanedSlug,
    contentInput: { locale: "id", slug: cleanedSlug },
    toolCallId: "tool-1",
    url: `https://nakafa.com/id/${cleanedSlug}`,
    writer,
  } satisfies RouteParams;
}

describe("material/exercises", () => {
  it("fetches exercise set content through the contents package", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(Effect.succeed([exercise]));
    vi.mocked(getMaterials).mockResolvedValue([]);
    vi.mocked(getCurrentMaterial).mockReturnValue({
      currentMaterial: {
        title: "Material",
        description: "Material desc",
        href: "",
        items: [],
      },
      currentMaterialItem: { title: "Set 10", href: "" },
    });
    const { parts, writer } = createWriter();
    const cleanedSlug =
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10";

    const output = await Effect.runPromise(
      fetchExercises(createParams(cleanedSlug, writer))
    );

    expect(output).toContain("What is 1 + 1?");
    expect(parts.at(-1)).toMatchObject({
      data: {
        title: "Set 10",
        description: "Material desc",
        status: "done",
      },
    });
    expect(getExercisesContent).toHaveBeenCalledWith({
      locale: "id",
      filePath: cleanedSlug,
      includeMDX: false,
    });
  });

  it("fetches single exercise content through the contents package", async () => {
    vi.mocked(getExerciseByNumber).mockReturnValue(
      Effect.succeed(Option.some(exercise))
    );
    vi.mocked(getMaterials).mockResolvedValue([]);
    vi.mocked(getCurrentMaterial).mockReturnValue({
      currentMaterial: undefined,
      currentMaterialItem: { title: "Exercise 1", href: "" },
    });
    const { writer } = createWriter();
    const cleanedSlug =
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1";

    await Effect.runPromise(fetchExercises(createParams(cleanedSlug, writer)));

    expect(getExerciseByNumber).toHaveBeenCalledWith(
      "id",
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10",
      1,
      false
    );
    expect(getCurrentMaterial).toHaveBeenCalledWith(
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10",
      []
    );
  });

  it("writes empty metadata when the exercise material lookup has no match", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(Effect.succeed([exercise]));
    vi.mocked(getMaterials).mockResolvedValue([]);
    vi.mocked(getCurrentMaterial).mockReturnValue({
      currentMaterial: undefined,
      currentMaterialItem: undefined,
    });
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      fetchExercises(
        createParams(
          "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10",
          writer
        )
      )
    );

    expect(parts.at(-1)).toMatchObject({
      data: {
        title: "",
        description: "",
        status: "done",
      },
    });
  });

  it("writes an error part when a single exercise is missing", async () => {
    vi.mocked(getExerciseByNumber).mockReturnValue(
      Effect.succeed(Option.none())
    );
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      fetchExercises(
        createParams(
          "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1",
          writer
        )
      )
    );

    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error:
          "Exercises not found. Maybe not available or still in development.",
      },
    });
  });

  it("writes an error part when exercise content lookup fails", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(
      Effect.fail(
        new ExerciseLoadError({
          path: "exercises/missing",
          reason: "missing",
        })
      )
    );
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      fetchExercises(createParams("exercises/missing", writer))
    );

    expect(output).toContain("Exercises not found");
    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error:
          "Exercises not found. Maybe not available or still in development.",
      },
    });
  });

  it("writes an error part when exercise content is empty", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(Effect.succeed([]));
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      fetchExercises(createParams("exercises/missing", writer))
    );

    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error:
          "Exercises not found. Maybe not available or still in development.",
      },
    });
  });

  it("writes an error part when exercise material segments are incomplete", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(Effect.succeed([exercise]));
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      fetchExercises(createParams("exercises/high-school", writer))
    );

    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error:
          "Exercises material not found. Maybe not available or still in development.",
      },
    });
  });
});
