import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Exit, Option, Result, Schema } from "effect";
import type { ClassPost } from "@/components/tenant/classes/home/optimistic";
import { publishPost } from "@/components/tenant/classes/home/publish";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const author = {
  id: Schema.decodeUnknownSync(Id("tenantPeople"))("person-1"),
  name: "Bu Rina",
};
const args = {
  classId,
  clientKey: "0b5c9d1e-4f3a-4c2b-9a8d-7e6f5a4b3c2d",
  email: true,
  slug,
  text: "Ulangan hari Senin.",
};

/** The announcement the server answers with, under the ID it gave. */
const stored: ClassPost = {
  author,
  clientKey: args.clientKey,
  createdAt: 1000,
  editedAt: null,
  email: true,
  id: Schema.decodeUnknownSync(Id("classroomPosts"))("post-1"),
  mine: true,
  text: args.text,
};

describe("publishPost", () => {
  it.effect(
    "posts with an update that shows the announcement at once under its client key, and answers the stored one",
    () =>
      Effect.gen(function* () {
        const publish = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed(stored))
        );

        expect(yield* publishPost(publish, author, args)).toEqual(stored);

        const setQuery = vi.fn();
        const update = publish.mock.calls[0]?.[0];
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
      const publish = () => Promise.resolve(Result.fail("refused"));

      const exit = yield* Effect.exit(publishPost(publish, author, args));

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});
