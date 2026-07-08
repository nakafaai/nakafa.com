import { Nakafa, type NakafaRuntime } from "@repo/ai/agents/nakafa/service";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  getUnknownErrorMessage,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  normalizeNakafaContentInput,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import { defaultLocale, locales } from "@repo/utilities/locales";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Option, Schema } from "effect";

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

/** Creates a minimal writer for Nakafa tool data-part tests. */
export function createWriter() {
  const parts: WrittenPart[] = [];
  const writer = {
    write: (part) => {
      parts.push(part);
    },
  } satisfies Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

  return { parts, writer };
}

/** Creates an injected Nakafa runtime adapter for AI tool unit tests. */
export function createNakafaTestService(
  overrides: Partial<NakafaRuntime> = {}
) {
  return Nakafa.make({
    ...nakafaTestRuntime,
    ...overrides,
  });
}

const nakafaTestRuntime = {
  /** Returns deterministic Quran references and missing ranges for tests. */
  quran: (input) => {
    const parsed = Schema.decodeUnknownOption(
      NakafaAgentQuranReferenceOptionsSchema
    )(input);

    if (Option.isNone(parsed)) {
      return Effect.fail(
        new NakafaAgentInputError({
          cause: getUnknownErrorMessage(input),
          message: "Invalid Nakafa Quran reference options.",
        })
      );
    }

    if (parsed.value.from_verse === 999) {
      return Effect.succeed(Option.none());
    }

    const ref = readNakafaContentRefFixture(
      parsed.value.locale,
      `quran/${parsed.value.surah}`,
      "quran"
    );
    const verse = {
      arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
      number: parsed.value.from_verse,
      ...(parsed.value.include_tafsir
        ? { tafsir: "Tafsir from the injected test adapter." }
        : {}),
      translation: "In the name of Allah.",
      transliteration: "Bismillahirrahmanirrahim",
    };

    return Effect.succeed(
      Option.some({
        ...ref,
        name: "Al-Faatiha",
        revelation: "Mecca",
        translation: "The Opening",
        verses: [verse],
      })
    );
  },
  /** Returns deterministic markdown for service-injection tests. */
  read: (input) => {
    const ref = resolveNakafaTestContentRef(input);

    if (Option.isNone(ref) || ref.value.route.includes("missing")) {
      return Effect.succeed(Option.none());
    }

    return Effect.succeed(
      Option.some({
        ...ref.value,
        description: "Runtime content fixture.",
        text: "# Nakafa Content\n\nSynced runtime markdown.",
        title: "Nakafa Content",
      })
    );
  },
  /** Returns deterministic taxonomy for service-injection tests. */
  taxonomy: (locale = defaultLocale) =>
    Effect.succeed({
      articles: { categories: ["politics"] },
      content_counts: [{ count: 1, locale }],
      default_locale: defaultLocale,
      endpoints: {
        direct: "https://mcp.nakafa.com/mcp",
        recommended: "https://nakafa.com/mcp",
        root_note: "https://mcp.nakafa.com is informational only.",
      },
      tryout: {
        countries: [{ id: "indonesia", label: "Indonesia" }],
        exams: [{ id: "snbt", label: "SNBT" }],
      },
      locale,
      locales: Array.from(locales),
      quran: { surah_count: 114 },
      sections: ["articles", "material", "tryout", "quran"],
      subject: {
        categories: ["high-school"],
        grades: ["10"],
        materials: ["mathematics"],
      },
      tools: [
        "nakafa_search_content",
        "nakafa_get_content",
        "nakafa_get_taxonomy",
        "nakafa_get_quran_reference",
      ],
    }),
  /** Returns whether the test adapter can parse one content reference. */
  verify: (input) =>
    Effect.succeed(Option.isSome(resolveNakafaTestContentRef(input))),
} satisfies NakafaRuntime;

const nakafaTestRefs = [
  readNakafaContentRefFixture(
    "en",
    "articles/politics/dynastic-politics-asian-values",
    "articles"
  ),
  readNakafaContentRefFixture("en", "articles/politics/missing", "articles"),
  readNakafaContentRefFixture("en", "try-out/indonesia/snbt/set-2", "tryout"),
] as const;

/** Resolves graph content IDs and public URL projections for injected tests. */
function resolveNakafaTestContentRef(input: string) {
  const parsed = parseNakafaContentRef(input);

  if (Option.isSome(parsed)) {
    return parsed;
  }

  const normalized = normalizeNakafaContentInput(input);
  const ref = nakafaTestRefs.find((item) => item.content_id === normalized);

  if (!ref) {
    return Option.none();
  }

  return Option.some(ref);
}
