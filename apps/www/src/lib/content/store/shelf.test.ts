// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { answerShelfRequest } from "@/lib/content/store/shelf";

const KEY = "b".repeat(64);

/** Answers one request as the read store's server would. */
const answer = (directory: string, path: string, init?: RequestInit) =>
  answerShelfRequest(directory).pipe(
    Effect.provide(
      Layer.succeed(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(new Request(`http://store${path}`, init))
      )
    )
  );

/** The text of one answer. */
const textOf = (response: HttpServerResponse.HttpServerResponse) =>
  HttpServerResponse.toWeb(response).text();

describe("answerShelfRequest", () => {
  it.effect("answers an entry after a request kept it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      const kept = yield* answer(directory, `/${KEY}`, {
        body: '{"value":"lesson"}',
        method: "PUT",
      });
      const read = yield* answer(directory, `/${KEY}`);

      expect(kept.status).toBe(204);
      expect(read.status).toBe(200);
      expect(yield* Effect.promise(() => textOf(read))).toBe(
        '{"value":"lesson"}'
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("answers 404 for an entry it does not keep", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      expect((yield* answer(directory, `/${KEY}`)).status).toBe(404);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("refuses a path that is no entry's digest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      expect((yield* answer(directory, "/../secret")).status).toBe(400);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
