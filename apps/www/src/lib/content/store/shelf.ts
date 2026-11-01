import { Effect, FileSystem, Option, Path, String as Str } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

/** The path of one entry: the digest that the content store keys it by. */
const ENTRY_PATH = /^\/[0-9a-f]{64}$/u;

/**
 * Answers one request of the deploy's read store: `PUT` keeps an entry as a file
 * of `directory`, and `GET` answers it. A deploy restores that directory from the
 * last deploy of the same release, so what never changed is not read again. A
 * failure is a 500, which the content store treats as a miss.
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
    return (yield* fs.exists(file))
      ? HttpServerResponse.text(yield* fs.readFileString(file))
      : HttpServerResponse.empty({ status: 404 });
  },
  Effect.orDie
);
