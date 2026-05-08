import { isNumericString } from "@repo/ai/agents/content/tools/material/input";
import { api } from "@repo/connection/routes";
import {
  getCurrentMaterial,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { Effect } from "effect";
import { formatExercises, formatOutput } from "./output";
import type { RouteParams } from "./types";

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
  const { data: exercisesData, error: exercisesError } =
    yield* Effect.tryPromise(() =>
      api.contents.getExercises({
        slug: `${contentInput.locale}/${cleanedSlug}`,
        withRaw: true,
      })
    );

  if (exercisesError) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "error",
          error: exercisesError.message,
        },
      })
    );

    return formatOutput({
      output: { url, content: exercisesError.message },
    });
  }

  if (!exercisesData || exercisesData.length === 0) {
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
  const lastSlug = slugParts.at(-1);
  const filePath =
    lastSlug && isNumericString(lastSlug)
      ? slugParts.slice(0, -1).join("/")
      : cleanedSlug;

  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    filePath,
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
        output: exercisesData,
        locale: contentInput.locale,
      }),
    },
  });
});
