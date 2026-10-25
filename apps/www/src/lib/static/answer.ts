import { FetchClient } from "@repo/utilities/http/client";
import { X_TSS_SERIALIZED } from "@tanstack/react-start";
import { Effect, Option } from "effect";
import { HttpClient } from "effect/http";
import { readStaticFile, staticDataPath } from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";

/**
 * Reads the static answer of one server function call, as the Response that the
 * function's own decoder takes. A call that the build did not prerender, such as a
 * later page of a list, has no file, and a read that fails cannot answer either:
 * both read as none, and the loader asks the Worker.
 */
export const readStaticAnswer = Effect.fn("www.static.readAnswer")(
  function* (url: string, data: unknown) {
    const key = yield* staticCallKey(url, data);
    const response = yield* HttpClient.get(staticDataPath(key));
    if (response.status !== 200) {
      return Option.none();
    }
    const file = new Uint8Array(yield* response.arrayBuffer);
    return Option.map(
      readStaticFile(file),
      ({ body, contentType }) =>
        new Response(body, {
          headers: { "content-type": contentType, [X_TSS_SERIALIZED]: "true" },
        })
    );
  },
  Effect.catchTag("HttpClientError", () => Effect.succeedNone),
  Effect.provide(FetchClient)
);
