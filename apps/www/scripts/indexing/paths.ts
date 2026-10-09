import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Effect, Path } from "effect";

/** Canonical production host used by sitemap, IndexNow, Bing, and Google checks. */
export const INDEXING_HOST = COMPANY_IDENTITY.url;

/** Hostname submitted to IndexNow after sitemap URLs prove canonical coverage. */
export const INDEXING_HOSTNAME = new URL(INDEXING_HOST).hostname;

/** Public IndexNow verification key filename served from Nakafa's public root. */
export const INDEXNOW_KEY_FILE_NAME = "e22d548f7fd2482a9022e3b84e944901.txt";

/** Public IndexNow verification key; this is not a service-account secret. */
export const INDEXNOW_KEY = "e22d548f7fd2482a9022e3b84e944901";

/** Absolute public URL proving Nakafa owns the IndexNow key. */
export const INDEXNOW_KEY_LOCATION = `${INDEXING_HOST}/${INDEXNOW_KEY_FILE_NAME}`;

/**
 * Resolves the ignored local files the indexing scripts keep beside the
 * `scripts` folder: the service-account key used only at the CLI boundary,
 * the state folder shared by the indexing adapters, and the history file
 * that prevents duplicate URL notifications.
 */
export const indexingFiles = Effect.gen(function* () {
  const path = yield* Path.Path;
  const scriptDirectory = path.dirname(
    yield* Effect.orDie(path.fromFileUrl(new URL(import.meta.url)))
  );
  const scriptsDirectory = path.dirname(scriptDirectory);
  const stateFolder = path.join(scriptsDirectory, "state");
  return {
    googleKey: path.join(scriptsDirectory, "google-key.json"),
    stateFolder,
    submissionHistory: path.join(stateFolder, "submission-history.json"),
  };
});
