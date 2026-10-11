import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { readLessons } from "@repo/backend/confect/contents/sections/lessons";
import { readSurah } from "@repo/backend/confect/contents/sections/quran";
import spec from "@repo/backend/confect/contents/sections/rows.spec";
import {
  knownSections,
  pageTexts,
  pruneSections,
  storeSections,
} from "@repo/backend/confect/contents/sections/store";
import { Effect, Layer } from "effect";

const lessons = FunctionImpl.make(
  databaseSchema,
  spec,
  "lessons",
  Effect.fn("contents.sections.rows.lessons")(function* (args) {
    return yield* readLessons(args);
  })
);
const surah = FunctionImpl.make(
  databaseSchema,
  spec,
  "surah",
  Effect.fn("contents.sections.rows.surah")(function* (args) {
    return yield* readSurah(args);
  })
);
const stored = FunctionImpl.make(
  databaseSchema,
  spec,
  "stored",
  Effect.fn("contents.sections.rows.stored")(function* (args) {
    return yield* knownSections(args);
  })
);
const save = FunctionImpl.make(
  databaseSchema,
  spec,
  "save",
  Effect.fn("contents.sections.rows.save")(function* (args) {
    return yield* storeSections(args);
  })
);
const prune = FunctionImpl.make(
  databaseSchema,
  spec,
  "prune",
  Effect.fn("contents.sections.rows.prune")(function* (args) {
    return yield* pruneSections(args);
  })
);
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contents.sections.rows.page")(function* (args) {
    return yield* pageTexts(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(lessons),
  Layer.provide(surah),
  Layer.provide(stored),
  Layer.provide(save),
  Layer.provide(prune),
  Layer.provide(page),
  GroupImpl.finalize
);
