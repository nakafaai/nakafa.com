// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Option,
  Order,
} from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { TestClock } from "effect/testing";
import {
  answerShelfRequest,
  keepShelfEntries,
} from "@/lib/content/store/shelf";

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

  it.effect(
    "marks an answered entry as used by this build, and leaves the others",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const other = "c".repeat(64);
        for (const key of [KEY, other]) {
          yield* answer(directory, `/${key}`, { body: "{}", method: "PUT" });
          yield* fs.utimes(`${directory}/${key}`, 0, 0);
        }

        const readAt = 1_794_000_000_000;
        yield* TestClock.setTime(readAt);
        yield* answer(directory, `/${KEY}`);

        const used = yield* fs.stat(`${directory}/${KEY}`);
        const left = yield* fs.stat(`${directory}/${other}`);
        expect(Option.getOrThrow(used.mtime).getTime()).toBe(readAt);
        expect(Option.getOrThrow(left.mtime).getTime()).toBe(0);
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

/** When the deploy marked its restore. */
const MARKED_AT = 1_794_000_000_000;

/**
 * A restored store: the mark and two entries the restore wrote before it, and
 * the entries this deploy's build touched after it.
 */
const restoreShelf = Effect.fn("test.restoreShelf")(function* (
  touched: readonly string[]
) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped();
  const at = (millis: number) =>
    DateTime.toDateUtc(DateTime.makeUnsafe(millis));
  const mark = `${directory}/.restored`;
  yield* fs.writeFileString(mark, "");
  yield* fs.utimes(mark, at(MARKED_AT), at(MARKED_AT));
  for (const key of [KEY, "c".repeat(64)]) {
    yield* fs.writeFileString(`${directory}/${key}`, "{}");
    yield* fs.utimes(`${directory}/${key}`, at(0), at(0));
  }
  for (const key of touched) {
    yield* fs.writeFileString(`${directory}/${key}`, "{}");
    yield* fs.utimes(
      `${directory}/${key}`,
      at(MARKED_AT + 1000),
      at(MARKED_AT + 1000)
    );
  }
  return { directory, mark };
});

/** The entries left in a store, by name. */
const entriesOf = Effect.fn("test.entriesOf")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  return Arr.sort(yield* fs.readDirectory(directory), Order.String);
});

describe("keepShelfEntries", () => {
  it.effect(
    "keeps every restored entry when the deploy's build read nothing",
    () =>
      Effect.gen(function* () {
        const shelf = yield* restoreShelf([]);

        const kept = yield* keepShelfEntries({ ...shelf, finished: true });

        expect(kept).toEqual({ changed: false, dropped: 0, used: 0 });
        expect(yield* entriesOf(shelf.directory)).toEqual([
          ".restored",
          KEY,
          "c".repeat(64),
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("drops the entries that a finished build did not use", () =>
    Effect.gen(function* () {
      const shelf = yield* restoreShelf(["d".repeat(64)]);

      const kept = yield* keepShelfEntries({ ...shelf, finished: true });

      expect(kept).toEqual({ changed: true, dropped: 2, used: 1 });
      expect(yield* entriesOf(shelf.directory)).toEqual([
        ".restored",
        "d".repeat(64),
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "keeps every entry after a failed build, and saves what it added",
    () =>
      Effect.gen(function* () {
        const shelf = yield* restoreShelf(["d".repeat(64)]);

        const kept = yield* keepShelfEntries({ ...shelf, finished: false });

        expect(kept).toEqual({ changed: true, dropped: 0, used: 1 });
        expect(yield* entriesOf(shelf.directory)).toEqual([
          ".restored",
          KEY,
          "c".repeat(64),
          "d".repeat(64),
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
