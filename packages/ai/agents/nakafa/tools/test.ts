import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import type { LearningGraphIdentity } from "@nakafa/aksara-contracts/graph/spec";
import {
  ACTIVE_APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { Nakafa, type NakafaRuntime } from "@repo/ai/agents/nakafa/service";
import { makeQuranV2Fixture } from "@repo/ai/agents/nakafa/tools/fixture";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  getUnknownErrorMessage,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  createNakafaContentRefFromGraphProjection,
  normalizeNakafaContentInput,
} from "@repo/contents/_lib/agent/refs";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentReadableContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Option, Schema } from "effect";

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];
const defaultLocale = ACTIVE_APP_LOCALE_CODES[0];
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
  return Nakafa.of({
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
  /** Returns source-grounded V2 Quran data for AI tool tests. */
  quranV2: (input) => {
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
    return Effect.succeed(Option.some(makeQuranV2Fixture(parsed.value)));
  },
  /** Returns deterministic markdown for service-injection tests. */
  read: (input) => {
    const ref = resolveNakafaTestContentRef(input);
    if (Option.isNone(ref) || ref.value.route.includes("missing")) {
      return Effect.succeed(Option.none());
    }
    const readableRef = Schema.decodeUnknownOption(
      NakafaAgentReadableContentRefSchema
    )(ref.value);
    if (Option.isNone(readableRef)) {
      return Effect.succeed(Option.none());
    }
    return Effect.succeed(
      Option.some({
        ...readableRef.value,
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
      locales: Array.from(ACTIVE_APP_LOCALE_CODES),
      quran: { surah_count: 114 },
      sections: ["articles", "material", "tryout", "quran"],
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
  makeSnbtSetRef("en", "try-out/indonesia/snbt/2027/set-2", "set-2"),
] as const;
/** Builds one signed SNBT set reference for AI tests. */
export function makeSnbtSetRef(locale: Locale, route: string, setKey: string) {
  const graph = Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["tryout", "indonesia", "snbt", "2027", setKey],
      learningObject: ["tryout-set", "indonesia", "snbt", "2027", setKey],
      lens: ["tryout", "indonesia", "snbt"],
      appLocale: AppLocaleSchema.make(locale),
    })
  );
  return makeTryoutRef(graph, locale, route);
}
/** Builds one signed SNBT section reference for AI tests. */
export function makeSnbtSectionRef(
  locale: Locale,
  route: string,
  setKey: string,
  sectionKey: string
) {
  const graph = Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["tryout", "indonesia", "snbt", "2027", sectionKey],
      learningObject: [
        "tryout-section",
        "indonesia",
        "snbt",
        "2027",
        setKey,
        sectionKey,
      ],
      lens: ["tryout", "indonesia", "snbt"],
      appLocale: AppLocaleSchema.make(locale),
    })
  );
  return makeTryoutRef(graph, locale, route);
}
/** Converts one exact signed try-out identity into the shared agent ref. */
function makeTryoutRef(
  graph: LearningGraphIdentity,
  locale: Locale,
  route: string
) {
  return Option.getOrThrow(
    createNakafaContentRefFromGraphProjection({
      ...graph,
      content_id: graph.assetId,
      locale,
      route,
      section: "tryout",
    })
  );
}
/** Resolves graph content IDs and public URL projections for injected tests. */
function resolveNakafaTestContentRef(input: string) {
  const normalized = normalizeNakafaContentInput(input);
  const ref = nakafaTestRefs.find(
    (item) =>
      item.content_id === normalized ||
      normalizeNakafaContentInput(item.url) === normalized ||
      (item.markdown_url !== undefined &&
        normalizeNakafaContentInput(item.markdown_url) === normalized)
  );
  if (!ref) {
    return Option.none();
  }
  return Option.some(ref);
}
