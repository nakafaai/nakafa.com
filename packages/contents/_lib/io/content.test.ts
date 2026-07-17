import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ContentIO } from "@repo/contents/_lib/io/content";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let temporaryDirectory = "";

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "contents-io-"));
});

afterEach(async () => {
  await rm(temporaryDirectory, { force: true, recursive: true });
});

describe("ContentIO", () => {
  it("reads directories through Effect Platform", async () => {
    await mkdir(path.join(temporaryDirectory, "articles"));

    const entries = await Effect.runPromise(
      ContentIO.readDirectory(temporaryDirectory).pipe(
        Effect.provide(ContentIO.Default)
      )
    );

    expect(entries).toStrictEqual(["articles"]);
  });
});
