import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptsDirectory = path.dirname(scriptDirectory);

/** Canonical production host used by sitemap, IndexNow, Bing, and Google checks. */
export const INDEXING_HOST = "https://nakafa.com";

/** Hostname submitted to IndexNow after sitemap URLs prove canonical coverage. */
export const INDEXING_HOSTNAME = new URL(INDEXING_HOST).hostname;

/** Public IndexNow verification key filename served from Nakafa's public root. */
export const INDEXNOW_KEY_FILE_NAME = "e22d548f7fd2482a9022e3b84e944901.txt";

/** Public IndexNow verification key; this is not a service-account secret. */
export const INDEXNOW_KEY = "e22d548f7fd2482a9022e3b84e944901";

/** Absolute public URL proving Nakafa owns the IndexNow key. */
export const INDEXNOW_KEY_LOCATION = `${INDEXING_HOST}/${INDEXNOW_KEY_FILE_NAME}`;

/** Ignored local folder for URL submission state across indexing adapters. */
export const INDEXING_STATE_FOLDER = path.join(scriptsDirectory, "state");

/** Ignored local history file that prevents duplicate URL notifications. */
export const SUBMISSION_HISTORY_FILE = path.join(
  INDEXING_STATE_FOLDER,
  "submission-history.json"
);

/** Ignored local service-account key used only at the CLI boundary. */
export const GOOGLE_KEY_FILE = path.join(scriptsDirectory, "google-key.json");
