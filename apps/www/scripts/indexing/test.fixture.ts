import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Logger,
  MutableHashMap,
  MutableHashSet,
  MutableList,
  Option,
  Path,
} from "effect";
import { TestClock } from "effect/testing";
import { indexingFiles } from "@/scripts/indexing/paths";

/** The folder that holds a path: the text before its last slash. */
const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/"));

/**
 * A file system held in memory for one indexing test, seeded with `seeded`
 * entries and merged with the real path service. Each write is logged in
 * `events`, in the order the module makes it. A folder exists once
 * `makeDirectory` creates it or a seeded entry lies in it, and a write succeeds
 * only when the folder of its path exists. A read of a file that was never
 * written, and a write into a folder that was never created, are defects of
 * the module under test, so they die instead of answering.
 */
export function memoryFiles(
  events: MutableList.MutableList<string>,
  seeded: readonly (readonly [string, string])[]
) {
  const files = MutableHashMap.fromIterable(seeded);
  const directories = MutableHashSet.fromIterable(
    Arr.map(seeded, ([path]) => folderOf(path))
  );
  const layer = FileSystem.layerNoop({
    exists: (path) =>
      Effect.sync(
        () =>
          MutableHashMap.has(files, path) ||
          MutableHashSet.has(directories, path)
      ),
    makeDirectory: (path) =>
      Effect.sync(() => {
        MutableHashSet.add(directories, path);
      }),
    readFileString: (path) =>
      Effect.orDie(Effect.fromOption(MutableHashMap.get(files, path))),
    writeFileString: (path, text) =>
      Effect.fromOption(
        Option.liftPredicate(folderOf(path), (folder) =>
          MutableHashSet.has(directories, folder)
        )
      ).pipe(
        Effect.orDie,
        Effect.andThen(
          Effect.sync(() => {
            MutableHashMap.set(files, path, text);
            MutableList.append(events, `write ${path}`);
          })
        )
      ),
  });
  return {
    directories,
    files,
    layer: Layer.merge(Path.layer, layer),
  };
}

/** Routes every log line of an effect into `lines`, instead of the console. */
export const recordLogs = (lines: MutableList.MutableList<string>) =>
  Logger.layer([
    Logger.make<unknown, void>(({ message }) => {
      MutableList.append(lines, String(message));
    }),
  ]);

/**
 * Runs an effect to its end. The test clock advances once, by one minute, after
 * the effect starts, so the waits of the run must add up to at most one minute.
 * A run that waits longer in total does not finish.
 */
export function runToEnd<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(effect);
    yield* TestClock.adjust("1 minute");
    return yield* Fiber.join(fiber);
  });
}

/** Runs an effect that must fail, and returns its typed failure. */
export function runToFailure<A, E>(effect: Effect.Effect<A, E>) {
  return runToEnd(Effect.flip(effect));
}

/** The state paths of the real checkout, read through the real path service. */
export const indexingPaths = indexingFiles.pipe(Effect.provide(Path.layer));

/** Builds n distinct canonical URLs, in order. */
export function urlsOf(count: number) {
  return Arr.makeBy(count, (index) => `https://nakafa.com/id/page-${index}`);
}

/** An answer with the given status and body text. */
export const answer = (status: number, body = "") =>
  new Response(body, { status });

/** A refused answer whose JSON body carries a quota message, as Bing sends it. */
export const quotaAnswer = (message: string) =>
  new Response(encodeJsonText({ Message: message }), { status: 400 });

/** A Google Indexing API document that holds a job posting, which the API accepts. */
export const JOB_POSTING = encodeJsonText({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Teacher",
});

/** A document that holds an article, which the Google Indexing API does not accept. */
export const ARTICLE = encodeJsonText({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Vektor",
});
