import { decodeNakafaAgentExerciseResult } from "@repo/contents/_lib/agent/exercise/read";
import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { decodeNakafaAgentMarkdown } from "@repo/contents/_lib/agent/read/markdown";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import type { Locale } from "@repo/utilities/locales";
import { Effect, Option, Schema } from "effect";
import {
  getRuntimeExerciseGroupPage,
  getRuntimeExerciseQuestionPage,
  getRuntimeExerciseSetPage,
} from "@/lib/content/runtime";

const YEAR_SEGMENT = /^\d{4}$/;

/** Reads an exercise set or one question from the Convex runtime model. */
export function readExercise(
  ref: NakafaAgentContentRef,
  exerciseNumber?: number
) {
  return Effect.gen(function* () {
    const target = getExerciseTarget(ref.route, exerciseNumber);
    const setPage = yield* getRuntimeExerciseSetPage({
      locale: ref.locale,
      slug: target.setRoute,
    });

    if (!setPage) {
      return Option.none();
    }

    const exercises = Option.match(target.number, {
      onNone: () => setPage.exercises,
      onSome: (number) =>
        setPage.exercises.filter((exercise) => exercise.number === number),
    });

    if (exercises.length === 0) {
      return Option.none();
    }

    const setRef = buildNakafaContentRef(
      ref.locale,
      target.setRoute,
      "exercises"
    );
    const resultInput = {
      ...setRef,
      count: exercises.length,
      exercises: exercises.map((exercise) => ({
        answer: {
          raw: exercise.answer.raw,
          title: exercise.answer.metadata.title,
        },
        choices: exercise.choices[ref.locale].map((choice) => ({
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
    const result = yield* decodeNakafaAgentExerciseResult(
      Option.match(target.number, {
        onNone: () => resultInput,
        onSome: (number) => ({
          ...resultInput,
          exercise_number: number,
        }),
      })
    );

    return Option.some(result);
  });
}

/** Renders Convex exercise rows as agent markdown. */
export function readExerciseMarkdown(ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const exercise = yield* readExercise(ref);

    if (Option.isNone(exercise)) {
      return Option.none();
    }

    const routeTitle = formatNakafaRouteTitle(exercise.value.route, ref.locale);
    const markdown = yield* decodeNakafaAgentMarkdown({
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

/** Verifies set, question, and group exercise routes against Convex. */
export function verifyExercise(ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const questionNumber = getQuestionNumberFromRoute(ref.route);

    if (Option.isSome(questionNumber)) {
      const question = yield* getRuntimeExerciseQuestionPage({
        locale: ref.locale,
        slug: ref.route,
      });

      return question !== null;
    }

    const setPage = yield* getRuntimeExerciseSetPage({
      locale: ref.locale,
      slug: ref.route,
    });

    if (setPage) {
      return true;
    }

    const groupArgs = getExerciseGroupArgs(ref.locale, ref.route);

    if (Option.isNone(groupArgs)) {
      return false;
    }

    const group = yield* getRuntimeExerciseGroupPage(groupArgs.value);
    return group !== null;
  });
}

/** Resolves a question route to its parent set and optional question number. */
function getExerciseTarget(route: string, exerciseNumber?: number) {
  const routeNumber = getQuestionNumberFromRoute(route);
  const setRoute = Option.isSome(routeNumber)
    ? route.split("/").slice(0, -1).join("/")
    : route;

  if (typeof exerciseNumber === "number") {
    return {
      number: Option.some(exerciseNumber),
      setRoute,
    };
  }

  return {
    number: routeNumber,
    setRoute,
  };
}

/** Reads a numeric question segment only when the parent segment is a set. */
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

/** Parses exercise group routes such as exercises/.../try-out/2026. */
function getExerciseGroupArgs(locale: Locale, route: string) {
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
