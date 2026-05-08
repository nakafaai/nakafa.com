import {
  formatExercises,
  formatOutput,
} from "@repo/ai/agents/content/tools/material/output";
import type { RouteParams } from "@repo/ai/agents/content/tools/material/types";
import {
  getCurrentMaterial,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises/set";
import { getExerciseSetTarget } from "@repo/contents/_lib/exercises/slug";
import { Effect, Either, Option } from "effect";

/**
 * Fetches exercise content and writes the matching UI data part state.
 */
export const fetchExercises = Effect.fn("content.fetchExercises")(function* ({
  cleanedSlug,
  contentInput,
  toolCallId,
  url,
  writer,
}: RouteParams) {
  const target = getExerciseSetTarget(cleanedSlug);
  const exercisesData = yield* Effect.either(
    Option.match(target.exerciseNumber, {
      onNone: () =>
        getExercisesContent({
          locale: contentInput.locale,
          filePath: target.filePath,
          includeMDX: false,
        }),
      onSome: (exerciseNumber) =>
        getExerciseByNumber(
          contentInput.locale,
          target.filePath,
          exerciseNumber,
          false
        ).pipe(
          Effect.map((exercise) =>
            Option.match(exercise, {
              onNone: () => [],
              onSome: (item) => [item],
            })
          )
        ),
    })
  );

  if (Either.isLeft(exercisesData)) {
    const message =
      "Exercises not found. Maybe not available or still in development.";

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error: message,
        },
      })
    );

    return formatOutput({
      output: { url, content: message },
    });
  }

  if (exercisesData.right.length === 0) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error:
            "Exercises not found. Maybe not available or still in development.",
        },
      })
    );

    return formatOutput({ output: { url, content: "" } });
  }

  const slugParts = cleanedSlug.split("/").filter(Boolean);
  const [, category, type, material] = slugParts;
  const hasRequiredParts = Boolean(category && type && material);

  if (!hasRequiredParts) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error:
            "Exercises material not found. Maybe not available or still in development.",
        },
      })
    );

    return formatOutput({ output: { url, content: "" } });
  }

  const materialPath = `/exercises/${category}/${type}/${material}` as const;
  const materials = yield* Effect.tryPromise(() =>
    getMaterials(materialPath, contentInput.locale)
  );

  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    target.filePath,
    materials
  );

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-get-content",
      data: {
        url,
        title: currentMaterialItem?.title || "",
        description: currentMaterial?.description || "",
        status: "done",
      },
    })
  );

  return formatOutput({
    output: {
      url,
      content: formatExercises({
        output: exercisesData.right,
        locale: contentInput.locale,
      }),
    },
  });
});
