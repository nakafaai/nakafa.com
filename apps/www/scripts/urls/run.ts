import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";
import type { Answer } from "@/scripts/urls/answer";
import { readAnswer } from "@/scripts/urls/answer";
import { readLedger, writeLedger } from "@/scripts/urls/ledger";
import { readSitemapPaths } from "@/scripts/urls/sitemap";

/** How many addresses the check asks the site about at once. */
const CHECK_CONCURRENCY = 8;

/** Published addresses that no longer reach a page or 410 Gone. */
class BrokenAddressError extends Schema.TaggedError<
  BrokenAddressError,
  { readonly brand: unique symbol }
>()("BrokenAddressError", { report: Schema.String }) {}

/**
 * The ledger committed beside this module: every address published before the
 * deploys kept one, from the sitemap and Search Console's reports of 21
 * November 2026.
 */
const seedLedger = Effect.gen(function* () {
  const path = yield* Path.Path;
  const directory = path.dirname(
    yield* Effect.orDie(path.fromFileUrl(new URL(import.meta.url)))
  );
  return path.join(directory, "published.txt");
});

/** The paths of one ledger file, or none when no file is there yet. */
const readLedgerFile = Effect.fn("scripts.urls.readLedgerFile")(function* (
  file: string
) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(file))) {
    return [];
  }
  return readLedger(yield* fs.readFileString(file));
});

/**
 * Writes the ledger a deploy checks: the committed seed, the ledger the last
 * deploy kept, and every page the live sitemap lists before this deploy
 * replaces the site. A page published once therefore stays in the ledger.
 */
export const recordLedger = Effect.fn("scripts.urls.recordLedger")(function* ({
  ledger,
  origin,
}: {
  ledger: string;
  origin: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const kept = yield* readLedgerFile(ledger);
  const seed = yield* readLedgerFile(yield* seedLedger);
  const listed = yield* readSitemapPaths(origin);
  const text = writeLedger(Arr.flatten([seed, kept, listed]));
  yield* fs.makeDirectory(path.dirname(ledger), { recursive: true });
  yield* fs.writeFileString(ledger, text);
  yield* Effect.log(
    `The ledger holds ${readLedger(text).length} published addresses; the sitemap lists ${listed.length}.`
  );
});

/** One line of the report: the address and each hop it took. */
function describe(answer: Answer) {
  const hops = Arr.map(answer.hops, ({ path, status }) =>
    status === 0 ? `no answer at ${path}` : `${status} at ${path}`
  );
  return `${answer.path}: ${Arr.join(hops, ", then ")}`;
}

/**
 * Asks the site about every address in the ledger and fails, naming each one,
 * unless every address still reaches a page or answers 410 Gone. A page that
 * moved needs its redirect, and a page removed for good needs its 410, before
 * the deploy that drops it.
 */
export const checkLedger = Effect.fn("scripts.urls.checkLedger")(function* ({
  ledger,
  origin,
}: {
  ledger: string;
  origin: string;
}) {
  const paths = yield* readLedgerFile(ledger);
  const answers = yield* Effect.forEach(
    paths,
    (path) => readAnswer(origin, path),
    { concurrency: CHECK_CONCURRENCY }
  );
  const broken = Arr.filter(answers, ({ verdict }) => verdict === "broken");
  const gone = Arr.filter(answers, ({ verdict }) => verdict === "gone");
  yield* Effect.log(
    `${answers.length - broken.length - gone.length} addresses reach a page, ${gone.length} answer 410 Gone, ${broken.length} are broken.`
  );
  if (Arr.isReadonlyArrayNonEmpty(broken)) {
    const report = Arr.join(Arr.map(broken, describe), "\n");
    yield* Effect.logError(`Broken published addresses:\n${report}`);
    return yield* new BrokenAddressError({ report });
  }
});
