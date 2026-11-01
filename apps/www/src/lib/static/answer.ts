import { FetchClient } from "@repo/utilities/http/client";
import { X_TSS_SERIALIZED } from "@tanstack/react-start";
import { Effect, MutableHashMap, Option } from "effect";
import { HttpClient } from "effect/http";
import { readStaticFile, staticDataPath } from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";

/** The most answers one document keeps, far more than a reading session opens. */
const KEPT_ANSWERS = 256;

/**
 * The static answers this document has read, by file. An answer belongs to the build
 * of the page's own chunks, so it cannot change under the page, and a second read of
 * it, a move back or a preload that a press follows, asks no network. A miss is not
 * kept, because a failed read says nothing about the file.
 */
const keptAnswers = MutableHashMap.empty<
  string,
  { readonly body: Uint8Array<ArrayBuffer>; readonly contentType: string }
>();

/** The Response that a server function's own decoder takes for one static answer. */
function answerOf(file: {
  readonly body: BodyInit;
  readonly contentType: string;
}) {
  return new Response(file.body, {
    headers: { "content-type": file.contentType, [X_TSS_SERIALIZED]: "true" },
  });
}

/**
 * Reads the static answer of one server function call, as the Response that the
 * function's own decoder takes. A call that the build did not prerender, such as a
 * later page of a list, has no file, and a read that fails cannot answer either:
 * both read as none, and the loader asks the Worker.
 */
export const readStaticAnswer = Effect.fn("www.static.readAnswer")(
  function* (url: string, data: unknown) {
    const key = yield* staticCallKey(url, data);
    const kept = MutableHashMap.get(keptAnswers, key);
    if (Option.isSome(kept)) {
      return Option.some(answerOf(kept.value));
    }
    const response = yield* HttpClient.get(staticDataPath(key));
    if (response.status !== 200) {
      return Option.none();
    }
    const read = readStaticFile(new Uint8Array(yield* response.arrayBuffer));
    return Option.map(read, (file) => {
      if (MutableHashMap.size(keptAnswers) >= KEPT_ANSWERS) {
        MutableHashMap.clear(keptAnswers);
      }
      MutableHashMap.set(keptAnswers, key, file);
      return answerOf(file);
    });
  },
  Effect.catchTag("HttpClientError", () => Effect.succeedNone),
  Effect.provide(FetchClient)
);
