import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/quran.spec";
import { readQuranAttribution } from "@repo/backend/content/quran/attribution";
import { readQuranSurahs } from "@repo/backend/content/quran/catalog";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranDocument } from "@repo/backend/content/quran/document";
import { readQuranInterpretation } from "@repo/backend/content/quran/interpretation";
import { readQuranMarkdown } from "@repo/backend/content/quran/markdown";
import { readQuranPassage } from "@repo/backend/content/quran/reference";
import { readQuranView } from "@repo/backend/content/quran/view";
import { Effect, Layer } from "effect";

const attribution = FunctionImpl.make(
  databaseSchema,
  spec,
  "attribution",
  Effect.fn("contentRelease.quran.attribution")(function* () {
    return yield* readQuranAttribution().pipe(Effect.provide(quranLayer));
  })
);
const surahs = FunctionImpl.make(
  databaseSchema,
  spec,
  "surahs",
  Effect.fn("contentRelease.quran.surahs")(function* () {
    return yield* readQuranSurahs().pipe(Effect.provide(quranLayer));
  })
);
const surah = FunctionImpl.make(
  databaseSchema,
  spec,
  "surah",
  Effect.fn("contentRelease.quran.surah")(function* ({
    appLocale,
    surahNumber,
  }) {
    return yield* readQuranDocument(appLocale, surahNumber).pipe(
      Effect.provide(quranLayer)
    );
  })
);
const prose = FunctionImpl.make(
  databaseSchema,
  spec,
  "prose",
  Effect.fn("contentRelease.quran.prose")(function* ({
    appLocale,
    surahNumber,
    verseLimit,
  }) {
    return yield* readQuranMarkdown(appLocale, surahNumber, verseLimit).pipe(
      Effect.provide(quranLayer)
    );
  })
);
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.quran.page")(function* ({
    appLocale,
    surahNumber,
  }) {
    return yield* readQuranView(appLocale, surahNumber).pipe(
      Effect.provide(quranLayer)
    );
  })
);
const tafsir = FunctionImpl.make(
  databaseSchema,
  spec,
  "tafsir",
  Effect.fn("contentRelease.quran.tafsir")(function* ({
    appLocale,
    expectedSnapshotId,
    surahNumber,
    verseNumber,
  }) {
    return yield* readQuranInterpretation(
      appLocale,
      expectedSnapshotId,
      surahNumber,
      verseNumber
    ).pipe(Effect.provide(quranLayer));
  })
);
const passage = FunctionImpl.make(
  databaseSchema,
  spec,
  "passage",
  Effect.fn("contentRelease.quran.passage")(function* (args) {
    return yield* readQuranPassage(args).pipe(Effect.provide(quranLayer));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(attribution),
  Layer.provide(surahs),
  Layer.provide(surah),
  Layer.provide(prose),
  Layer.provide(page),
  Layer.provide(tafsir),
  Layer.provide(passage),
  GroupImpl.finalize
);
