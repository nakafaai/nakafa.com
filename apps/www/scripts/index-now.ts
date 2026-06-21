/**
 * IndexNow/Bing CLI boundary.
 *
 * The runner derives every candidate URL from Nakafa's sitemap entries so URL
 * notification cannot become a second route source of truth. Local submission
 * history is ignored git state and only prevents repeated notifications.
 */

// Environment variables loaded via Node.js --env-file flag.
import { Effect } from "effect";
import { runIndexNow } from "@/scripts/indexing/indexnow/run";
import { logger } from "@/scripts/utils";

Effect.runPromise(
  runIndexNow().pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        logger.error(`Error running indexing script: ${error}`);
        process.exit(1);
      })
    )
  )
);
