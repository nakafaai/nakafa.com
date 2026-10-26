import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Exit, Option, Result, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import {
  addLibraryLink,
  uploadLibraryFile,
} from "@/components/tenant/classes/library/add";
import type { LibraryItem } from "@/components/tenant/classes/library/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const args = {
  address: "https://youtu.be/gerak-lurus",
  classId,
  clientKey: "0b5c9d1e-4f3a-4c2b-9a8d-7e6f5a4b3c2d",
  slug,
  title: "Video gerak lurus",
};

/** The link the server answers with, under the ID it gave. */
const stored: LibraryItem = {
  address: args.address,
  author: "Bu Rina",
  byteSize: null,
  clientKey: args.clientKey,
  createdAt: 1000,
  id: Schema.decodeUnknownSync(Id("classroomLibrary"))("item-1"),
  kind: "link",
  title: args.title,
};

/** The address that `classroom.library.uploadUrl` answers with. */
const requestUrl = () =>
  Promise.resolve(Result.succeed(new URL("https://upload.test/file")));

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

describe("addLibraryLink", () => {
  it.effect(
    "adds with an update that shows the link at once under its client key, and answers the stored one",
    () =>
      Effect.gen(function* () {
        const add = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed(stored))
        );
        expect(yield* addLibraryLink(add, "Bu Rina", args)).toEqual(stored);
        const setQuery = vi.fn();
        const update = add.mock.calls[0]?.[0];
        if (typeof update === "function") {
          update(
            {
              getAllQueries: () => [
                {
                  args: { classId, paginationOpts: { cursor: null } },
                  value: Option.some({ isDone: true, page: [] }),
                },
              ],
              setQuery,
            },
            args
          );
        }
        expect(setQuery.mock.calls[0]?.[2]).toEqual(
          Option.some({
            isDone: true,
            page: [{ ...stored, createdAt: 0, id: args.clientKey }],
          })
        );
      })
  );

  it.effect("fails with the refusal the server answers", () =>
    Effect.gen(function* () {
      const add = () => Promise.resolve(Result.fail("refused"));
      const exit = yield* Effect.exit(addLibraryLink(add, "Bu Rina", args));
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("uploadLibraryFile", () => {
  it.effect(
    "sends the file to its address, then registers the stored file, and fails with the server's refusal",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            new Response(encodeJsonText({ storageId: "store-1" }), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
        );
        const file = new File(["%PDF-1.7"], "modul.pdf", {
          type: "application/pdf",
        });
        const register = vi.fn((_storageId: unknown) =>
          Promise.resolve(Result.succeed({ id: stored.id }))
        );
        const kept = yield* uploadLibraryFile(file, requestUrl, register).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        expect(kept).toEqual({ id: stored.id });
        expect(register).toHaveBeenCalledWith("store-1");
        const refusal = yield* uploadLibraryFile(file, requestUrl, () =>
          Promise.resolve(Result.fail({ _tag: "FileTypeRefused" }))
        ).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher),
          Effect.flip
        );
        expect(refusal).toEqual({ _tag: "FileTypeRefused" });
      })
  );
});
