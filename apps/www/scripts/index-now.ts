/**
 * IndexNow/Bing CLI boundary.
 *
 * The runner derives every candidate URL from Nakafa's sitemap entries so URL
 * notification cannot become a second route source of truth. Local submission
 * history is ignored git state and only prevents repeated notifications.
 */

// Environment variables loaded via Node.js --env-file flag.
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Layer } from "effect";
import { runIndexNow } from "@/scripts/indexing/indexnow/run";
import { IndexingLogger } from "@/scripts/indexing/logger";

Effect.runPromise(
  runIndexNow().pipe(
    Effect.catch((error) =>
      Effect.logError(`Error running indexing script: ${error}`).pipe(
        Effect.andThen(
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    ),
    Effect.provide(Layer.merge(IndexingLogger, FetchClient))
  )
);
