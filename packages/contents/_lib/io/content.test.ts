import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { ContentIO } from "@repo/contents/_lib/io/content";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let temporaryDirectory = "";

/** Starts a local text server and returns its URL plus a close function. */
async function startTextServer(text: string) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(text);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (typeof address !== "object" || address === null) {
    throw new Error("Expected local HTTP server address.");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    url: `http://127.0.0.1:${address.port}/content.txt`,
  };
}

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "contents-io-"));
});

afterEach(async () => {
  if (!temporaryDirectory) {
    return;
  }

  await rm(temporaryDirectory, { force: true, recursive: true });
  temporaryDirectory = "";
});

describe("ContentIO", () => {
  it("reads files, directories, stats, and fetched text through Effect Platform", async () => {
    const filePath = path.join(temporaryDirectory, "lesson.txt");
    await writeFile(filePath, "local lesson", "utf8");
    const server = await startTextServer("remote lesson");

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const raw = yield* ContentIO.readFileString(filePath);
          const entries = yield* ContentIO.readDirectory(temporaryDirectory);
          const info = yield* ContentIO.stat(filePath);
          const remote = yield* ContentIO.fetchText(server.url);

          return { entries, info, raw, remote };
        }).pipe(Effect.provide(ContentIO.Default))
      );

      expect(result.raw).toBe("local lesson");
      expect(result.entries).toContain("lesson.txt");
      expect(result.info.type).toBe("File");
      expect(result.remote).toBe("remote lesson");
    } finally {
      await server.close();
    }
  });
});
