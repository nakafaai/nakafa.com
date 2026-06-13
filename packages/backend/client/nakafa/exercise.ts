import {
  decodeNakafaExerciseResult,
  decodeNakafaMarkdown,
} from "@repo/backend/client/nakafa/decode";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import type { NakafaAgentExerciseResult } from "@repo/contents/_lib/agent/schema/exercise";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import type { Locale } from "@repo/utilities/locales";
import { Effect, Option, Schema } from "effect";

const YEAR_SEGMENT = /^\d{4}$/;

/** Reads structured exercise data from Convex runtime rows. */
export function readNakafaExercise(
  convexUrl: string,
  input: string,
  exerciseNumber?: number
) {
  return Effect.gen(function* () {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);

    if (Option.isNone(ref) || ref.value.section !== "exercises") {
      return Option.none<NakafaAgentExerciseResult>();
    }

    const target = getExerciseTarget(
      ref.value.locale,
      ref.value.route,
      exerciseNumber
    );

    if (Option.isNone(target)) {
      return Option.none<NakafaAgentExerciseResult>();
    }

    const page = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getExerciseSetPage",
      api.contents.queries.runtime.getExerciseSetPage,
      {
        locale: ref.value.locale,
        slug: target.value.setRoute,
      }
    );

    if (!page) {
      return Option.none<NakafaAgentExerciseResult>();
    }

    const exercises = Option.match(target.value.number, {
      /** Keeps the whole set when no specific question is requested. */
      onNone: () => page.exercises,
      /** Selects one requested question from the set rows. */
      onSome: (number) =>
        page.exercises.filter((exercise) => exercise.number === number),
    });

    if (exercises.length === 0) {
      return Option.none<NakafaAgentExerciseResult>();
    }

    const resultInput = {
      ...ref.value,
      count: exercises.length,
      exercises: exercises.map((exercise) => ({
        answer: {
          raw: exercise.answer.raw,
          title: exercise.answer.metadata.title,
        },
        choices: exercise.choices[ref.value.locale].map((choice) => ({
          correct: choice.value,
          label: choice.label,
        })),
        number: exercise.number,
        question: {
          raw: exercise.question.raw,
          title: exercise.question.metadata.title,
        },
      })),
    };
    const result = yield* decodeNakafaExerciseResult(
      Option.match(target.value.number, {
        /** Returns set-level output when no specific question is requested. */
        onNone: () => resultInput,
        /** Marks the result as a single-question response. */
        onSome: (number) => ({
          ...resultInput,
          exercise_number: number,
        }),
      })
    );

    return Option.some(result);
  });
}

/** Renders an exercise set as full agent markdown. */
export function readExerciseMarkdown(
  convexUrl: string,
  ref: NakafaAgentContentRef
) {
  return Effect.gen(function* () {
    const exercise = yield* readNakafaExercise(convexUrl, ref.content_id);

    if (Option.isNone(exercise)) {
      return Option.none<NakafaAgentMarkdown>();
    }

    const routeTitle = formatNakafaRouteTitle(exercise.value.route, ref.locale);
    const markdown = yield* decodeNakafaMarkdown({
      ...ref,
      description: `${exercise.value.count} exercises`,
      text: [
        `# ${routeTitle}`,
        "",
        ...exercise.value.exercises.flatMap((item) => [
          `## Exercise ${item.number}`,
          "",
          "### Question",
          "",
          item.question.raw.trim(),
          "",
          "### Choices",
          "",
          ...item.choices.map(
            (choice) => `- [${choice.correct ? "x" : " "}] ${choice.label}`
          ),
          "",
          "### Answer & Explanation",
          "",
          item.answer.raw.trim(),
          "",
        ]),
      ].join("\n"),
      title: routeTitle,
    });

    return Option.some(markdown);
  });
}

/** Resolves a question route to its parent set and optional question number. */
export function getExerciseTarget(
  locale: Locale,
  route: string,
  exerciseNumber?: number
) {
  const routeNumber = getQuestionNumberFromRoute(route);
  const setRoute = Option.isSome(routeNumber)
    ? route.split("/").slice(0, -1).join("/")
    : route;

  if (!isExerciseSetRoute(locale, setRoute)) {
    return Option.none();
  }

  if (typeof exerciseNumber === "number") {
    if (Option.isSome(routeNumber) && routeNumber.value !== exerciseNumber) {
      return Option.none();
    }

    return Option.some({
      number: Option.some(exerciseNumber),
      setRoute,
    });
  }

  return Option.some({
    number: routeNumber,
    setRoute,
  });
}

/** Returns whether a route points to a concrete exercise set. */
function isExerciseSetRoute(locale: Locale, route: string) {
  const parts = route.split("/");
  const setSegment = parts.at(-1);

  if (!setSegment?.startsWith("set-")) {
    return false;
  }

  const groupRoute = parts.slice(0, -1).join("/");
  return Option.isSome(getExerciseGroupArgs(locale, groupRoute));
}

/** Reads a numeric exercise question segment only under a set segment. */
function getQuestionNumberFromRoute(route: string) {
  const parts = route.split("/");
  const lastPart = parts.at(-1);
  const parentPart = parts.at(-2);

  if (!(lastPart && parentPart?.startsWith("set-"))) {
    return Option.none<number>();
  }

  const number = Number.parseInt(lastPart, 10);

  if (!(Number.isSafeInteger(number) && `${number}` === lastPart)) {
    return Option.none<number>();
  }

  return Option.some(number);
}

/** Parses exercise group route segments into the Convex query args. */
export function getExerciseGroupArgs(locale: Locale, route: string) {
  const parts = route.split("/");

  if (parts.length !== 5 && parts.length !== 6) {
    return Option.none();
  }

  const [root, category, type, material, exerciseType, year] = parts;

  if (root !== "exercises" || !exerciseType) {
    return Option.none();
  }

  const parsedCategory = Schema.decodeUnknownOption(ExercisesCategorySchema)(
    category
  );
  const parsedType = Schema.decodeUnknownOption(ExercisesTypeSchema)(type);
  const parsedMaterial = Schema.decodeUnknownOption(ExercisesMaterialSchema)(
    material
  );

  if (
    Option.isNone(parsedCategory) ||
    Option.isNone(parsedType) ||
    Option.isNone(parsedMaterial)
  ) {
    return Option.none();
  }

  if (year && !YEAR_SEGMENT.test(year)) {
    return Option.none();
  }

  return Option.some({
    category: parsedCategory.value,
    exerciseType,
    locale,
    material: parsedMaterial.value,
    type: parsedType.value,
    year,
  });
}
