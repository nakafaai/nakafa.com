import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  quranAppLocaleValidator,
  quranReferenceArgsValidator,
  quranSourceFields,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/confect/contentRelease/quran/spec";
import { quranMarkdownValidator } from "@repo/backend/content/quran/contract";
import {
  quranDocumentValidator,
  quranInterpretationValidator,
  quranPassageValidator,
  quranViewValidator,
} from "@repo/backend/content/quran/response";
import { Schema } from "effect";
export const attributionValidator = Schema.Struct({
  ...quranSourceFields,
  rowJson: Schema.Union([Schema.String, Schema.Null]),
});
export const surahCatalogValidator = Schema.Struct({
  ...quranSourceFields,
  rowJson: Schema.mutable(Schema.Array(Schema.String)),
});

/** Returns the visible signed source attribution for active Quran content. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "attribution",
      args: () => ({}),
      returns: () => attributionValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "surahs",
      args: () => ({}),
      returns: () => surahCatalogValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "surah",
      args: () => ({
        appLocale: quranAppLocaleValidator,
        surahNumber: Schema.Finite,
      }),
      returns: () => quranDocumentValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "prose",
      args: () => ({
        appLocale: quranAppLocaleValidator,
        surahNumber: Schema.Finite,
        verseLimit: Schema.optionalKey(Schema.Finite),
      }),
      returns: () => quranMarkdownValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "page",
      args: () => ({
        appLocale: quranAppLocaleValidator,
        surahNumber: Schema.Finite,
      }),
      returns: () => quranViewValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "tafsir",
      args: () => ({
        expectedSnapshotId: Schema.String,
        appLocale: quranTafsirAppLocaleValidator,
        surahNumber: Schema.Finite,
        verseNumber: Schema.Finite,
      }),
      returns: () => quranInterpretationValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "passage",
      args: () => quranReferenceArgsValidator.fields,
      returns: () => quranPassageValidator,
      error: () => ReleaseError,
    })
  );
