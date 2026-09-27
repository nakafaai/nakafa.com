import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/quran.spec";
import { readQuranAttribution } from "@repo/backend/content/quran/attribution";
import { readQuranSurahs } from "@repo/backend/content/quran/catalog";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
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
    const ctx = yield* QueryCtxService;
    return yield* readQuranAttribution().pipe(
      Effect.provide(convexQuranLayer(ctx))
    );
  })
);
const surahs = FunctionImpl.make(
  databaseSchema,
  spec,
  "surahs",
  Effect.fn("contentRelease.quran.surahs")(function* () {
    const ctx = yield* QueryCtxService;
    return yield* readQuranSurahs().pipe(Effect.provide(convexQuranLayer(ctx)));
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
    const ctx = yield* QueryCtxService;
    return yield* readQuranDocument(appLocale, surahNumber).pipe(
      Effect.provide(convexQuranLayer(ctx))
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
    const ctx = yield* QueryCtxService;
    return yield* readQuranMarkdown(appLocale, surahNumber, verseLimit).pipe(
      Effect.provide(convexQuranLayer(ctx))
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
    const ctx = yield* QueryCtxService;
    return yield* readQuranView(appLocale, surahNumber).pipe(
      Effect.provide(convexQuranLayer(ctx))
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
    const ctx = yield* QueryCtxService;
    return yield* readQuranInterpretation(
      appLocale,
      expectedSnapshotId,
      surahNumber,
      verseNumber
    ).pipe(Effect.provide(convexQuranLayer(ctx)));
  })
);
const passage = FunctionImpl.make(
  databaseSchema,
  spec,
  "passage",
  Effect.fn("contentRelease.quran.passage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readQuranPassage(args).pipe(
      Effect.provide(convexQuranLayer(ctx))
    );
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
