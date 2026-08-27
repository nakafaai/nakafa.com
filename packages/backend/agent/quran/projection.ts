import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import {
  projectQuranPredecessorVerse,
  projectQuranVerse,
} from "@repo/backend/agent/quran/verse";
import type { PredecessorQuranReference } from "@repo/backend/client/quran/predecessor";
import type { PublishedQuranReference } from "@repo/backend/client/quran/reference";
import { hasExpectedQuranSources } from "@repo/backend/client/quran/source";
import type { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { NakafaAgentQuranPredecessorSchema } from "@repo/contents/_lib/agent/schema/quran/predecessor";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran/reference";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect } from "effect";

type QuranReferenceResult = Effect.Success<
  ReturnType<typeof readQuranReference>
>;
type QuranEmbeddedProjection =
  | NonNullable<QuranReferenceResult["sources"]>["arabic" | "translation"]
  | Extract<
      NonNullable<QuranReferenceResult["tafsirAccess"]>,
      { readonly kind: "embedded" }
    >["source"];

interface QuranProjectionInput {
  readonly appLocale: AppLocaleCode;
  readonly includeTafsir: boolean;
  readonly ref: NakafaAgentContentRef;
}

interface QuranPredecessorProjectionInput extends QuranProjectionInput {
  readonly reference: PredecessorQuranReference;
}

interface QuranReferenceProjectionInput extends QuranProjectionInput {
  readonly reference: PublishedQuranReference;
}

/** Projects the stable predecessor Quran contract. */
export const projectNakafaQuranPredecessor = Effect.fn(
  "agent.quran.projectPredecessor"
)(function* (input: QuranPredecessorProjectionInput) {
  const verses = yield* Effect.forEach(input.reference.verses, (verse) =>
    projectQuranPredecessorVerse(verse, input.appLocale, input.includeTafsir)
  );
  return yield* decodeAgentOutput(
    NakafaAgentQuranPredecessorSchema,
    {
      ...input.ref,
      name: input.reference.surah.name.transliteration,
      revelation: input.reference.surah.revelation.place,
      translation: input.reference.surah.name.translation,
      verses,
    },
    "Unable to build Nakafa Quran reference."
  );
});

/** Projects the canonical Quran contract with semantic notes and signed sources. */
export const projectNakafaQuranReference = Effect.fn(
  "agent.quran.projectReference"
)(function* (input: QuranReferenceProjectionInput) {
  const { sources, tafsirAccess } = input.reference;
  if (
    sources === null ||
    tafsirAccess === null ||
    !hasExpectedQuranSources(sources, tafsirAccess, input.appLocale)
  ) {
    return yield* new NakafaAgentDataReadError({
      cause: `Signed Quran reference has incomplete ${input.appLocale} source attribution.`,
      message: "Unable to read signed Nakafa Quran reference.",
    });
  }
  const verses = yield* Effect.forEach(input.reference.verses, (verse) =>
    projectQuranVerse(verse, input.appLocale, input.includeTafsir)
  );
  return yield* decodeAgentOutput(
    NakafaAgentQuranReferenceSchema,
    {
      ...input.ref,
      meaning:
        input.reference.surah.name.meaning.appLocale === input.appLocale
          ? {
              locale: input.reference.surah.name.meaning.appLocale,
              text: input.reference.surah.name.meaning.text,
            }
          : null,
      name: input.reference.surah.name.transliteration,
      pre_bismillah: input.reference.preBismillah,
      revelation: input.reference.surah.revelation.place,
      sources: {
        arabic: projectEmbeddedSource(sources.arabic),
        translation: {
          ...projectEmbeddedSource(sources.translation),
          locale: input.appLocale,
        },
      },
      tafsir_access: projectTafsirAccess(tafsirAccess),
      verses,
    },
    "Unable to build Nakafa Quran reference."
  );
});

/** Converts one signed embedded projection into stable public field names. */
function projectEmbeddedSource<const Source extends QuranEmbeddedProjection>(
  source: Source
) {
  return {
    artifact: projectArtifact(source.artifact),
    id: source.id,
    kind: source.kind,
    label: source.label,
    notice: source.notice,
    publisher: source.publisher,
    retrieved_at: source.retrievedAt,
    source_url: source.sourceUrl,
    terms: {
      artifact: projectArtifact(source.terms.artifact),
      url: source.terms.url,
    },
    update_url: source.updateUrl,
    version: source.version,
  };
}

/** Converts one signed external projection into stable public field names. */
function projectExternalSource(
  source: Extract<
    NonNullable<QuranReferenceResult["tafsirAccess"]>,
    { readonly kind: "external" }
  >["source"]
) {
  return {
    id: source.id,
    kind: source.kind,
    label: source.label,
    notice: source.notice,
    publisher: source.publisher,
    retrieved_at: source.retrievedAt,
    source_url: source.sourceUrl,
    terms: source.terms,
    update_url: source.updateUrl,
    version: source.version,
  };
}

/** Preserves the signed locale and source-kind relationship for tafsir. */
function projectTafsirAccess(
  access: NonNullable<QuranReferenceResult["tafsirAccess"]>
) {
  if (access.kind === "embedded") {
    return {
      kind: access.kind,
      locale: access.appLocale,
      notice: access.notice,
      source: projectEmbeddedSource(access.source),
    };
  }
  return {
    kind: access.kind,
    locale: access.appLocale,
    notice: access.notice,
    source: projectExternalSource(access.source),
  };
}

/** Converts signed artifact metadata into public snake-case fields. */
function projectArtifact(artifact: {
  readonly byteCount: number;
  readonly digest: string;
  readonly fileCount: number;
}) {
  return {
    byte_count: artifact.byteCount,
    digest: artifact.digest,
    file_count: artifact.fileCount,
  };
}
