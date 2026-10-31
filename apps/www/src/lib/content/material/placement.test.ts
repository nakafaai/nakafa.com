import { afterEach, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option } from "effect";
import { toMaterialNavigationPage } from "@/lib/content/material/navigation";
import {
  createPlacementStore,
  keepPlacement,
  readLessonPlacement,
  readLessonPlacementOnce,
} from "@/lib/content/material/placement";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  report: vi.fn(),
}));

/** The placement read, as the page loads it on first use. */
function mockPlacementRead() {
  return { readPublishedMaterialPlacement: mocks.read };
}
vi.mock("@/lib/content/material/context", mockPlacementRead);
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: mocks.report,
}));

/** One lesson page's navigation model, as its loader hands it to the page. */
const page = toMaterialNavigationPage({
  kind: "published",
  route: previewProjection,
  siblings: [previewProjection, previewNextProjection],
});

const HINT = "merdeka~class-11-mathematics-functions";

/** The curriculum context that the hint names. */
const context = {
  nodeKey: "class-11-mathematics-functions",
  programKey: "merdeka",
};

const placement = {
  context,
  hash: "functions",
  label: "Functions",
  trail: [],
  parent: {
    publicPath: PublicPathSchema.make(
      "curriculum/merdeka/class-11/mathematics"
    ),
  },
  resolvedCanonicalPath: page.route.publicPath,
};

describe("lesson placement in the browser", () => {
  afterEach(() => {
    mocks.read.mockReset();
    mocks.report.mockReset();
    vi.doMock("@/lib/content/material/context", mockPlacementRead);
  });

  it.effect("keeps the placement that the reader's hint verifies", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.succeed(placement));

      expect(
        yield* readLessonPlacement({ ctx: HINT, locale: "en", page })
      ).toStrictEqual(placement);
      expect(mocks.read).toHaveBeenCalledExactlyOnceWith(
        "en",
        page.route,
        context
      );
    })
  );

  it.effect("keeps no placement when the release verifies none", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.succeed(null));

      expect(
        yield* readLessonPlacement({ ctx: HINT, locale: "en", page })
      ).toBeNull();
    })
  );

  for (const ctx of [undefined, "", "merdeka", "merdeka~node~extra", "~node"]) {
    it.effect(`asks nothing and reads none for the hint ${String(ctx)}`, () =>
      Effect.gen(function* () {
        expect(
          yield* readLessonPlacement({ ctx, locale: "en", page })
        ).toBeNull();
        expect(mocks.read).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("asks nothing for a locale that the site does not serve", () =>
    Effect.gen(function* () {
      expect(
        yield* readLessonPlacement({ ctx: HINT, locale: "xx", page })
      ).toBeNull();
      expect(mocks.read).not.toHaveBeenCalled();
    })
  );

  it.effect("reports a failed read and keeps the lesson's own links", () =>
    Effect.gen(function* () {
      const cause = new Error("offline");
      mocks.read.mockReturnValue(Effect.fail(cause));
      mocks.report.mockReturnValue(Effect.void);

      expect(
        yield* readLessonPlacement({ ctx: HINT, locale: "en", page })
      ).toBeNull();
      expect(mocks.report).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ _tag: "PlacementReadFailed", cause }),
        { source: "material-placement" }
      );
    })
  );

  it.effect("reports a read that fails to load and asks nothing", () =>
    Effect.gen(function* () {
      vi.doMock("@/lib/content/material/context", () => {
        throw new Error("chunk failed to load");
      });
      mocks.report.mockReturnValue(Effect.void);

      expect(
        yield* readLessonPlacement({ ctx: HINT, locale: "en", page })
      ).toBeNull();
      expect(mocks.read).not.toHaveBeenCalled();
      expect(mocks.report).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ _tag: "PlacementReadFailed" }),
        { source: "material-placement" }
      );
    })
  );

  it("starts from the placement that the loader read, and keeps a later one", () => {
    expect(createPlacementStore(placement).getState().placement).toStrictEqual(
      Option.some(placement)
    );
    const store = createPlacementStore();
    expect(store.getState().placement).toStrictEqual(Option.none());

    keepPlacement(store, placement);
    expect(store.getState().placement).toStrictEqual(Option.some(placement));

    keepPlacement(store, null);
    expect(store.getState().placement).toStrictEqual(Option.none());
  });

  it.effect(
    "reads one lesson and hint once a page session, and another hint again",
    () =>
      Effect.gen(function* () {
        mocks.read.mockReturnValue(Effect.succeed(placement));
        const once = { ctx: `${HINT}-once`, locale: "en", page };

        expect(yield* readLessonPlacementOnce(once)).toStrictEqual(placement);
        expect(yield* readLessonPlacementOnce(once)).toStrictEqual(placement);
        expect(mocks.read).toHaveBeenCalledOnce();

        mocks.read.mockReturnValue(Effect.succeed(null));
        expect(
          yield* readLessonPlacementOnce({ ...once, ctx: `${HINT}-other` })
        ).toBeNull();
        expect(
          yield* readLessonPlacementOnce({ ...once, ctx: undefined })
        ).toBeNull();
        expect(mocks.read).toHaveBeenCalledTimes(2);
      })
  );
});
