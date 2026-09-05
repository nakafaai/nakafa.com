import { describe, expect, it } from "@effect/vitest";
import {
  decodeJsonRows,
  hashCanonicalJson,
  stripConvexSystemFields,
} from "@repo/backend/content/snapshot/json";
import { Effect } from "effect";

describe("snapshot JSON", () => {
  it.effect(
    "decodes exported object rows and rejects malformed or non-object records",
    () =>
      Effect.gen(function* () {
        expect(yield* decodeJsonRows(" \n ")).toEqual([]);
        expect(
          yield* decodeJsonRows('[{"count":2,"labels":["en",null]}]')
        ).toEqual([{ count: 2, labels: ["en", null] }]);
        for (const source of [
          "{",
          "{}",
          "[null]",
          "[3]",
          '[{"count":1e999}]',
        ]) {
          expect(yield* decodeJsonRows(source).pipe(Effect.flip)).toMatchObject(
            {
              _tag: "ContentSnapshotError",
            }
          );
        }
      })
  );

  it.effect(
    "canonicalizes object order while preserving array order and stored domain fields",
    () =>
      Effect.gen(function* () {
        const source = {
          _id: "source-id",
          _creationTime: 12,
          id: "domain-id",
          value: null,
        };
        expect(stripConvexSystemFields(source)).toEqual({
          id: "domain-id",
          value: null,
        });
        const first = yield* hashCanonicalJson({
          z: [true, null, 3],
          a: { c: "text", b: false },
        });
        expect(
          yield* hashCanonicalJson({
            a: { b: false, c: "text" },
            z: [true, null, 3],
          })
        ).toBe(first);
        expect(
          yield* hashCanonicalJson({
            a: { b: false, c: "text" },
            z: [3, null, true],
          })
        ).not.toBe(first);
      })
  );
});
