import { getExerciseQuestionNumberSegment } from "@repo/contents/_types/graph/route";
import { toPublicPracticeQuestionSegment } from "@repo/contents/_types/route/practice";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { getRuntimeExerciseSetPage } from "@/lib/content/runtime/pages";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";

const TRAILING_SLASH_PATTERN = /\/+$/;
const BLOCK_MATH_PATTERN =
  /<BlockMath\s+math=["']([\s\S]*?)["']\s*\/?>(?:<\/BlockMath>)?/g;
const DOUBLE_DOLLAR_MATH_PATTERN = /\$\$([\s\S]*?)\$\$/g;
const INLINE_MATH_PATTERN =
  /<InlineMath\s+math=["']([\s\S]*?)["']\s*\/?>(?:<\/InlineMath>)?/g;
const PUBLIC_URL_PATTERN = /\bhttps?:\/\/[^\s*)]+/g;
const SINGLE_DOLLAR_MATH_PATTERN = /(^|[^$\\])\$([^$\n]+)\$(?!\$)/g;
const TEXT_COMMAND_PATTERN = /\\text\{([^}]*)\}/g;
const WWW_PREFIX_PATTERN = /^www\./;

/** Runs the cached exercise markdown Effect at the Next cache boundary. */
export async function getCachedLlmsExerciseText({
  cleanSlug,
  locale,
  publicSlug,
}: {
  cleanSlug: string;
  locale: Locale;
  publicSlug?: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(
    getLlmsExerciseText({ cleanSlug, locale, publicSlug })
  );
}

/** Builds uncached exercise markdown from source content. */
export const getLlmsExerciseText = Effect.fn("www.llms.exercises.text")(
  function* ({
    cleanSlug,
    locale,
    publicSlug,
  }: {
    cleanSlug: string;
    locale: Locale;
    publicSlug?: string;
  }) {
    if (!cleanSlug.startsWith("material/practice")) {
      return null;
    }

    const { exerciseNumber, path } = getExerciseMarkdownTarget(cleanSlug);
    const setPage = yield* getRuntimeExerciseSetPage({
      locale,
      slug: path,
    });

    if (!setPage) {
      return null;
    }

    let targetExercises = setPage.exercises;

    if (Option.isSome(exerciseNumber)) {
      targetExercises = setPage.exercises.filter(
        (exercise) => exercise.number === exerciseNumber.value
      );
    }

    if (targetExercises.length === 0) {
      return null;
    }

    if (Option.isNone(exerciseNumber)) {
      return getExerciseSetIndexMarkdown({
        cleanSlug,
        locale,
        publicSlug,
        setPage,
      });
    }

    const description = getExerciseDescription({
      exerciseNumber: exerciseNumber.value,
      setPage,
      targetExercises,
    });
    const scanned = buildHeader({
      url: `${BASE_URL}/${locale}/${publicSlug ?? cleanSlug}`,
      description,
    });

    for (const exercise of targetExercises) {
      scanned.push(`## Exercise ${exercise.number}`);
      scanned.push("");
      scanned.push("### Question");
      scanned.push("");
      scanned.push(formatPublicExerciseMarkdown(exercise.question.raw));
      scanned.push("");
      scanned.push("### Choices");
      scanned.push("");

      const choices =
        (locale === "id" ? exercise.choices.id : exercise.choices.en) ||
        exercise.choices.en;

      if (choices) {
        for (const choice of choices) {
          scanned.push(`- ${formatPublicExerciseMarkdown(choice.label)}`);
        }
      }

      scanned.push("");
      scanned.push("---");
      scanned.push("");
    }

    return scanned.join("\n");
  }
);

/**
 * Builds set-level markdown as a question index so large practice sets stay
 * agent-readable while each concrete question remains available on its own URL.
 */
function getExerciseSetIndexMarkdown({
  cleanSlug,
  locale,
  publicSlug,
  setPage,
}: {
  cleanSlug: string;
  locale: Locale;
  publicSlug?: string;
  setPage: ExerciseSetPage;
}) {
  const baseSlug = (publicSlug ?? cleanSlug).replace(
    TRAILING_SLASH_PATTERN,
    ""
  );
  const scanned = buildHeader({
    url: `${BASE_URL}/${locale}/${baseSlug}`,
    description: getExerciseSetDescription(setPage),
  });

  scanned.push("## Questions");
  scanned.push("");

  for (const exercise of setPage.exercises) {
    const label = `Question ${exercise.number}`;
    const questionTitle = exercise.question.metadata.title;
    const questionSegment = readExerciseQuestionMarkdownSegment({
      locale,
      number: exercise.number,
      usesPublicSlug: Boolean(publicSlug),
    });
    const title = questionTitle ? `${label} - ${questionTitle}` : label;

    scanned.push(
      `- [${title}](${BASE_URL}/${locale}/${baseSlug}/${questionSegment}.md)`
    );
  }

  return scanned.join("\n");
}

/**
 * Resolves public localized question segments while source markdown keeps the
 * source-owned English `question-n` segment used by material assets.
 */
function readExerciseQuestionMarkdownSegment({
  locale,
  number,
  usesPublicSlug,
}: {
  locale: Locale;
  number: number;
  usesPublicSlug: boolean;
}) {
  if (usesPublicSlug) {
    return toPublicPracticeQuestionSegment({ locale, number });
  }

  return toPublicPracticeQuestionSegment({ locale: "en", number });
}

/** Finds the exercise set path and optional question number from a route. */
function getExerciseMarkdownTarget(cleanSlug: string) {
  const parts = cleanSlug.split("/");
  const lastPart = parts.at(-1);

  if (!lastPart) {
    return {
      exerciseNumber: Option.none(),
      path: cleanSlug,
    };
  }

  const exerciseNumber = getExerciseQuestionNumberSegment(lastPart);

  if (!exerciseNumber) {
    return {
      exerciseNumber: Option.none(),
      path: cleanSlug,
    };
  }

  return {
    exerciseNumber: Option.some(Number.parseInt(exerciseNumber, 10)),
    path: parts.slice(0, -1).join("/"),
  };
}

/**
 * Converts source MDX exercise text into the same visible text shape rendered
 * by public practice pages while preserving external hrefs for agents.
 */
function formatPublicExerciseMarkdown(raw: string) {
  return raw
    .replace(INLINE_MATH_PATTERN, (_, math: string) => formatMathText(math))
    .replace(BLOCK_MATH_PATTERN, (_, math: string) => formatMathText(math))
    .replace(DOUBLE_DOLLAR_MATH_PATTERN, (_, math: string) =>
      formatMathText(math)
    )
    .replace(
      SINGLE_DOLLAR_MATH_PATTERN,
      (_, prefix: string, math: string) => `${prefix}${formatMathText(math)}`
    )
    .replace(PUBLIC_URL_PATTERN, (url) => {
      const label = readPublicUrlLabel(url);
      return `[${label}](${url})`;
    });
}

/** Formats the LaTeX fragments that exercise pages render as visible text. */
function formatMathText(math: string) {
  return math
    .replace(TEXT_COMMAND_PATTERN, "$1")
    .replace(/\\%/g, "%")
    .replace(/\\[,;!]/g, " ")
    .replace(/\\quad/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the compact external-link text shown by the public MDX renderer. */
function readPublicUrlLabel(url: string) {
  const parsed = new URL(url);
  return parsed.hostname.replace(WWW_PREFIX_PATTERN, "");
}

type ExerciseSetPage = NonNullable<
  Effect.Effect.Success<ReturnType<typeof getRuntimeExerciseSetPage>>
>;
type ExerciseRows = ExerciseSetPage["exercises"];

/** Builds the markdown document description for an exercise page. */
function getExerciseDescription({
  exerciseNumber,
  setPage,
  targetExercises,
}: {
  exerciseNumber: number;
  setPage: ExerciseSetPage;
  targetExercises: ExerciseRows;
}) {
  const description = getExerciseSetDescription(setPage);

  const exerciseTitle = targetExercises[0]?.question.metadata.title;

  if (exerciseTitle) {
    return `${description} - ${exerciseTitle}`;
  }

  return `${description} - Question ${exerciseNumber}`;
}

/** Resolves the markdown description for an exercise set page. */
function getExerciseSetDescription(setPage: ExerciseSetPage) {
  if (setPage.description) {
    return setPage.description;
  }

  return setPage.title;
}
