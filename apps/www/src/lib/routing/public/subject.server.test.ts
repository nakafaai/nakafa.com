// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readSubjectSuccessor } from "@/lib/routing/public/subject.server";

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which the deployed Worker binds and a prerender does not. */
  env: {
    get ASSETS() {
      return release.hasStaticRelease ? assets : undefined;
    },
  },
}));

const LESSON = "material/lesson/mathematics/circle/central-angle";

beforeEach(() => {
  release.hasStaticRelease = true;
  assets.fetch.mockReset();
});

describe("readSubjectSuccessor", () => {
  it.effect("reads a lesson's successor from its locale's map", () =>
    Effect.gen(function* () {
      assets.fetch.mockResolvedValue(
        Response.json({ [LESSON]: "materi/matematika/lingkaran/sudut-pusat" })
      );

      const successor = yield* readSubjectSuccessor("id", LESSON);

      expect(successor).toEqual(
        Option.some("materi/matematika/lingkaran/sudut-pusat")
      );
      const [request] = assets.fetch.mock.calls[0] ?? [];
      expect(new URL(request?.url ?? "").pathname).toBe(
        "/_moved/subject/id.json"
      );
    })
  );

  it.effect("answers none for a lesson that the release does not hold", () =>
    Effect.gen(function* () {
      assets.fetch.mockResolvedValue(Response.json({}));

      expect(yield* readSubjectSuccessor("en", LESSON)).toEqual(Option.none());
    })
  );

  it.effect("reads no map in a prerender or a development server", () =>
    Effect.gen(function* () {
      release.hasStaticRelease = false;

      expect(yield* readSubjectSuccessor("en", LESSON)).toEqual(Option.none());
      expect(assets.fetch).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "fails when the release has no map, or one that does not decode",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
        const missing = yield* Effect.flip(readSubjectSuccessor("en", LESSON));
        assets.fetch.mockResolvedValueOnce(new Response("not json"));
        const broken = yield* Effect.flip(readSubjectSuccessor("en", LESSON));

        expect(missing).toMatchObject({
          _tag: "SubjectMapUnavailable",
          locale: "en",
          status: 404,
        });
        expect(broken).toMatchObject({
          _tag: "SubjectMapUnavailable",
          locale: "en",
        });
      })
  );
});
