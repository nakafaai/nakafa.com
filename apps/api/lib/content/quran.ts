import { decodePublishedQuranDocument } from "@repo/backend/client/quran/document";
import { readConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import { env } from "@/env";

type QuranDocumentArgs = FunctionArgs<typeof api.contentRelease.quran.document>;

/** The public API could not read or validate one signed Quran document. */
export class QuranApiReadError extends Schema.TaggedError<QuranApiReadError>()(
  "QuranApiReadError",
  { cause: Schema.Unknown }
) {}

/** Reads and validates one active signed Quran document for the public API. */
export const readQuranApiDocument = Effect.fn("api.quran.readDocument")(
  function* (args: QuranDocumentArgs) {
    const result = yield* readConvexRuntimeQuery(
      env.NEXT_PUBLIC_CONVEX_URL,
      api.contentRelease.quran.document,
      args
    );

    return yield* decodePublishedQuranDocument(result, {
      appLocale: args.appLocale,
      surahNumber: args.surahNumber,
    });
  },
  Effect.mapError((cause) => new QuranApiReadError({ cause }))
);
