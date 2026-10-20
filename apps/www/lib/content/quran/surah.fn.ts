import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The locale and the surah number of the route, as the URL names them. */
export const SurahRouteInput = Schema.Struct({
  locale: Schema.String,
  surah: Schema.String,
});

/**
 * Reads one surah with its verses, pagination and sources on the server. A
 * route that does not name a surah of the catalog is a 404.
 */
export const readSurahFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SurahRouteInput))
  .handler(async ({ data }) => {
    const { readSurahPage } = await import("@/lib/content/quran/surah.server");
    return readSurahPage(data);
  });

/**
 * Recovers a stale interpretation snapshot. The reader that served it asks once,
 * and the recovery decides, so the answer never names another snapshot.
 */
export const recoverQuranSnapshotFn = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ snapshotId: Schema.String }))
  )
  .handler(async ({ data }) => {
    const { recoverQuranSnapshotPage } = await import(
      "@/lib/content/quran/surah.server"
    );
    return recoverQuranSnapshotPage(data.snapshotId);
  });
