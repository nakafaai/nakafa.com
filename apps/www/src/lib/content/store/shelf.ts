import {
  Array as Arr,
  DateTime,
  Effect,
  FileSystem,
  Option,
  Order,
  Path,
  Result,
  String as Str,
} from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

/** The path of one entry: the digest that the content store keys it by. */
const ENTRY_PATH = /^\/[0-9a-f]{64}$/u;

/** The file name of one entry, which is its digest. */
const ENTRY_NAME = /^[0-9a-f]{64}$/u;

/** Whether a file changed after another. */
const isLater = Order.isGreaterThan(Order.Date);

/**
 * Answers one request of the deploy's read store: `PUT` keeps an entry as a file
 * of `directory`, and `GET` answers it. A deploy restores that directory from the
 * newest earlier deploy, so what never changed is not read again. An answered
 * entry takes the time of the read as its modification time, so the deploy keeps
 * the entries this build used and drops the rest (`keepShelfEntries`). A failure
 * is a 500, which the content store treats as a miss.
 */
export const answerShelfRequest = Effect.fn("www.static.answerShelfRequest")(
  function* (directory: string) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const entry = Str.match(ENTRY_PATH)(request.url);
    if (Option.isNone(entry)) {
      return HttpServerResponse.empty({ status: 400 });
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(directory, entry.value[0]);
    if (request.method === "PUT") {
      yield* fs.writeFileString(file, yield* request.text);
      return HttpServerResponse.empty({ status: 204 });
    }
    if (!(yield* fs.exists(file))) {
      return HttpServerResponse.empty({ status: 404 });
    }
    const now = DateTime.toDateUtc(yield* DateTime.now);
    yield* fs.utimes(file, now, now);
    return HttpServerResponse.text(yield* fs.readFileString(file));
  },
  Effect.orDie
);

/**
 * Keeps the entries that one deploy's build used, once the deploy ends. Every
 * entry that the store answered or wrote is newer than `mark`, which the deploy
 * touches right after it restores the store. A build that finished drops every
 * other entry, such as the answers of an earlier release, so the store holds one
 * build's reads; a failed or cancelled one drops nothing and keeps what it added.
 *
 * A deploy that touched no entry built no page: Alchemy planned no change to the
 * Worker, or the deploy stopped before the build read. Nothing proved an entry
 * unused, so it keeps every entry it restored. Dropping them would leave the next
 * deploy an empty store, which then reads the whole release from Convex again, as
 * the deploy of 9 November 2026 08:21 UTC did after a deploy that built nothing.
 *
 * It answers whether the store changed, which tells the deploy to save it.
 */
export const keepShelfEntries = Effect.fn("www.static.keepShelfEntries")(
  function* (input: {
    readonly directory: string;
    readonly finished: boolean;
    readonly mark: string;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const marked = (yield* fs.stat(input.mark)).mtime;
    const names = Arr.filter(yield* fs.readDirectory(input.directory), (name) =>
      Option.isSome(Str.match(ENTRY_NAME)(name))
    );
    const [used, unused] = yield* Effect.forEach(
      names,
      (name) => {
        const file = path.join(input.directory, name);
        return Effect.map(fs.stat(file), (info) =>
          Option.exists(Option.all([info.mtime, marked]), ([time, mark]) =>
            isLater(time, mark)
          )
            ? Result.succeed(file)
            : Result.fail(file)
        );
      },
      { concurrency: 16 }
    ).pipe(Effect.map((entries) => Arr.partition(entries, (entry) => entry)));
    if (Arr.isReadonlyArrayEmpty(used)) {
      return { changed: false, dropped: 0, used: 0 };
    }
    const dropped = input.finished ? unused : [];
    yield* Effect.forEach(dropped, (file) => fs.remove(file), {
      concurrency: 16,
      discard: true,
    });
    return { changed: true, dropped: dropped.length, used: used.length };
  }
);
