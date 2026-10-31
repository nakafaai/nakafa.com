import "@tanstack/react-start/server-only";

import { readEnvironment } from "@repo/utilities/env";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/**
 * The address of the deploy's read store (`scripts/static/store.ts`). Only a
 * deploy sets it, and only the build's processes receive it, so the deployed
 * Worker has no such store.
 */
function readBuildStoreAddress() {
  return readEnvironment(
    { NAKAFA_BUILD_STORE: Schema.UndefinedOr(Schema.NonEmptyString) },
    { NAKAFA_BUILD_STORE: process.env.NAKAFA_BUILD_STORE }
  ).NAKAFA_BUILD_STORE;
}

/** Reports a read store failure, which the build survives by reading Convex. */
const warnUnavailable = (error: unknown) =>
  Effect.logWarning("The deploy's read store is unavailable.", error);

const decodeEntry = Schema.decodeUnknownOption(JsonTextSchema);

/**
 * Reads one entry that an earlier step of this deploy, or an earlier deploy of
 * the same release, kept. Outside a deploy, a miss and a failure all answer none,
 * so the caller reads Convex.
 */
export const readBuildEntry = Effect.fn("www.content.store.readBuild")(
  function* (key: string) {
    const address = readBuildStoreAddress();
    if (address === undefined) {
      return Option.none<unknown>();
    }
    const response = yield* HttpClient.get(new URL(key, address));
    if (response.status !== 200) {
      return Option.none<unknown>();
    }
    return decodeEntry(yield* response.text);
  },
  (read) =>
    read.pipe(
      Effect.catchTag("HttpClientError", (error) =>
        warnUnavailable(error).pipe(Effect.as(Option.none<unknown>()))
      ),
      Effect.provide(FetchClient)
    )
);

/** Keeps one entry for the rest of this deploy and the next deploy of the release. */
export const writeBuildEntry = Effect.fn("www.content.store.writeBuild")(
  function* (key: string, entry: unknown) {
    const address = readBuildStoreAddress();
    if (address === undefined) {
      return;
    }
    yield* HttpClient.execute(
      HttpClientRequest.put(new URL(key, address)).pipe(
        HttpClientRequest.bodyText(encodeJsonText(entry))
      )
    );
  },
  (write) =>
    write.pipe(
      Effect.catchTag("HttpClientError", warnUnavailable),
      Effect.provide(FetchClient)
    )
);
