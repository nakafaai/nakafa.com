import { NodeFileSystem } from "@effect/platform-node";
import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";

const TraceSchema = Schema.fromJsonString(
  Schema.Struct({ files: Schema.Array(Schema.String) })
);
const imageRouteTraces = [
  ".next/server/app/og/[...slug]/route.js.nft.json",
  ".next/server/app/[locale]/og/[...slug]/route.js.nft.json",
];

/** Reads the files Next.js ships with one route's function. */
const readTracedFiles = Effect.fn("NakafaE2E.readTracedFiles")(function* (
  trace: string
) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(trace);
  const decoded = yield* Schema.decodeEffect(TraceSchema)(text);
  return decoded.files;
});

test("the image routes render and ship the logo they read", async ({
  request,
}) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        request.get("/en/og/image.png")
      );
      yield* Effect.sync(() => {
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toBe("image/png");
      });
      // A deployed function holds only its traced files, and the tracer
      // cannot follow a read through Effect's FileSystem. This server finds
      // the logo on disk either way, so the trace itself is the proof.
      yield* Effect.forEach(imageRouteTraces, (trace) =>
        readTracedFiles(trace).pipe(
          Effect.map((files) =>
            expect(
              Arr.some(files, (file) => file.endsWith("public/logo.svg"))
            ).toBe(true)
          )
        )
      );
    }).pipe(Effect.provide(NodeFileSystem.layer))
  );
});
