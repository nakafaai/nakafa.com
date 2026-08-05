import { decodePublishedQuranPage } from "@repo/backend/client/quran/decode";
import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import { env } from "@/env";

type QuranPageArgs = FunctionArgs<typeof api.contentRelease.quran.page>;

/** The public API could not read or validate one signed Quran page. */
export class QuranApiReadError extends Schema.TaggedError<QuranApiReadError>()(
  "QuranApiReadError",
  { cause: Schema.Unknown }
) {}

/** Reads and validates one active signed Quran page for the public API. */
export const readQuranApiPage = Effect.fn("api.quran.readPage")(function* (
  args: QuranPageArgs
) {
  const result = yield* Effect.tryPromise({
    try: () =>
      fetchConvexRuntimeQuery(
        env.NEXT_PUBLIC_CONVEX_URL,
        api.contentRelease.quran.page,
        args
      ),
    catch: (cause) => new QuranApiReadError({ cause }),
  });

  return yield* decodePublishedQuranPage(result, {
    locale: args.locale,
    surahNumber: args.surahNumber,
  }).pipe(Effect.mapError((cause) => new QuranApiReadError({ cause })));
});
