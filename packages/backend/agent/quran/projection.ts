import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import {
  projectQuranVerseV1,
  projectQuranVerseV2,
} from "@repo/backend/agent/quran/verse";
import type { PublishedQuranReference } from "@repo/backend/client/quran/decode";
import type { PublishedQuranReferenceV2 } from "@repo/backend/client/quran/v2/reference";
import { hasExpectedQuranSourcesV2 } from "@repo/backend/client/quran/v2/source";
import type { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentQuranReferenceV2Schema } from "@repo/contents/_lib/agent/schema/quran/reference";
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

interface QuranProjectionV1Input extends QuranProjectionInput {
  readonly reference: PublishedQuranReference;
}

interface QuranProjectionV2Input extends QuranProjectionInput {
  readonly reference: PublishedQuranReferenceV2;
}

/** Projects the stable V1 Quran contract without adding V2 fields. */
export const projectNakafaQuranReferenceV1 = Effect.fn(
  "agent.quran.projectReferenceV1"
)(function* (input: QuranProjectionV1Input) {
  const verses = yield* Effect.forEach(input.reference.verses, (verse) =>
    projectQuranVerseV1(verse, input.appLocale, input.includeTafsir)
  );
  return yield* decodeAgentOutput(
    NakafaAgentQuranReferenceSchema,
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

/** Projects the V2 Quran contract with semantic notes and signed sources. */
export const projectNakafaQuranReferenceV2 = Effect.fn(
  "agent.quran.projectReferenceV2"
)(function* (input: QuranProjectionV2Input) {
  const { sources, tafsirAccess } = input.reference;
  if (
    sources === null ||
    tafsirAccess === null ||
    !hasExpectedQuranSourcesV2(sources, tafsirAccess, input.appLocale)
  ) {
    return yield* new NakafaAgentDataReadError({
      cause: `Signed Quran reference has incomplete ${input.appLocale} source attribution.`,
      message: "Unable to read signed Nakafa Quran reference.",
    });
  }
  const verses = yield* Effect.forEach(input.reference.verses, (verse) =>
    projectQuranVerseV2(verse, input.appLocale, input.includeTafsir)
  );
  return yield* decodeAgentOutput(
    NakafaAgentQuranReferenceV2Schema,
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
    "Unable to build Nakafa Quran V2 reference."
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
