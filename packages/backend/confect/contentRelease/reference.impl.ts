import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/reference.spec";
import { articleLayer } from "@repo/backend/content/article/confect";
import { materialLayer } from "@repo/backend/content/material/confect";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readContentReference } from "@repo/backend/content/reference/read";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { Effect, Layer } from "effect";

/** Resolves one current public identity across active signed content families. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.reference.read")(function* ({ input }) {
    return yield* readContentReference(input).pipe(
      Effect.provide(
        Layer.mergeAll(articleLayer, materialLayer, quranLayer, tryoutLayer)
      )
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
