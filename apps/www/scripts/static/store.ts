/**
 * Serves the deploy's read store to the build's processes, which read and write
 * it over loopback because the prerender's Worker has no file system. A deploy
 * starts this before `alchemy deploy` and points `NAKAFA_BUILD_STORE` at it.
 */
import { createServer } from "node:http";
import {
  NodeHttpServer,
  NodeRuntime,
  NodeServices,
} from "@effect/platform-node";
import { Config, Effect, FileSystem } from "effect";
import { answerShelfRequest } from "@/lib/content/store/shelf";

const serve = Effect.gen(function* () {
  const directory = yield* Config.NonEmptyString(
    "NAKAFA_BUILD_STORE_DIRECTORY"
  );
  const address = new URL(yield* Config.NonEmptyString("NAKAFA_BUILD_STORE"));
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(directory, { recursive: true });
  const server = yield* NodeHttpServer.make(createServer, {
    host: address.hostname,
    port: Number(address.port),
  });
  yield* server.serve(answerShelfRequest(directory));
  return yield* Effect.never;
});

NodeRuntime.runMain(
  serve.pipe(Effect.scoped, Effect.provide(NodeServices.layer))
);
