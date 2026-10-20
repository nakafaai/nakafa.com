"use client";

import { Id } from "@repo/backend/confect/_generated/id";
import type { LogoAnswer } from "@repo/backend/confect/tenancy/schema";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, type Result, Schema } from "effect";
import {
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { logoAnswerOutcome } from "@/components/tenant/logo";

/** The answer of the upload address: the storage ID that Convex gave the file. */
const StoredFile = Schema.Struct({ storageId: Id("_storage") });

/** The school kept no logo, because the server refused the file it was given. */
class LogoNotSaved extends Schema.TaggedError<LogoNotSaved>()(
  "LogoNotSaved",
  {}
) {}

/** Awaits one mutation answer, and fails with the typed error that the answer holds. */
const awaited = <A, E>(call: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise(call).pipe(Effect.flatMap(Effect.fromResult));

/**
 * Sends one file to the upload address that `tenancy.logo.uploadUrl` answered, and
 * returns the storage ID that the file received. A refused upload fails with the
 * HTTP error, so no logo is set for it.
 */
const sendLogoFile = Effect.fn("tenant.settings.sendLogoFile")(
  function* (url: URL, file: File) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const request = HttpClientRequest.post(url, {
      body: HttpBody.raw(file, {
        contentLength: file.size,
        contentType: file.type,
      }),
    });
    const response = yield* client
      .execute(request)
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
    const stored =
      yield* HttpClientResponse.schemaBodyJson(StoredFile)(response);
    return stored.storageId;
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);

/**
 * Stores one logo for the school: it asks for an upload address, sends the file to
 * it, and sets the stored file as the logo. An answer that refuses the file fails
 * with `LogoNotSaved`, so the school keeps the logo it had.
 */
export function storeSchoolLogo<UrlError, SaveError>({
  file,
  requestUrl,
  save,
}: {
  file: File;
  requestUrl: () => Promise<Result.Result<URL, UrlError>>;
  save: (
    storageId: typeof StoredFile.Type.storageId
  ) => Promise<Result.Result<typeof LogoAnswer.Type, SaveError>>;
}) {
  return Effect.runPromise(
    Effect.result(
      Effect.gen(function* () {
        const url = yield* awaited(requestUrl);
        const storageId = yield* sendLogoFile(url, file);
        const answer = yield* awaited(() => save(storageId));
        if (logoAnswerOutcome(answer) === "refused") {
          return yield* new LogoNotSaved();
        }
        return answer;
      })
    )
  );
}
