import { afterEach, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option } from "effect";
import { toMaterialNavigationPage } from "@/lib/content/material/navigation";
import {
  createPlacementStore,
  startMaterialPlacement,
} from "@/lib/content/material/placement";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  report: vi.fn(),
  server: { url: "/_serverFn/placement" },
}));
vi.mock("@/lib/static/data", () => ({ readStaticData: mocks.read }));
vi.mock("@/lib/content/material/placement.functions", () => ({
  readMaterialPlacement: mocks.server,
}));
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

const placement = {
  context: { nodeKey: "class-11-mathematics-functions", programKey: "merdeka" },
  hash: "functions",
  label: "Functions",
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
  });

  it.effect("keeps the placement that the reader's hint verifies", () =>
    Effect.gen(function* () {
      const store = createPlacementStore();
      mocks.read.mockResolvedValue(placement);

      yield* startMaterialPlacement(store, { ctx: HINT, locale: "en", page });

      expect(store.getState().placement).toStrictEqual(Option.some(placement));
      expect(mocks.read).toHaveBeenCalledExactlyOnceWith(mocks.server, {
        contentKey: page.route.contentKey,
        ctx: HINT,
        locale: "en",
        materialKey: page.route.materialKey,
        parentPath: page.route.parentPath,
        publicPath: page.route.publicPath,
      });
    })
  );

  it.effect("keeps no placement when the release verifies none", () =>
    Effect.gen(function* () {
      const store = createPlacementStore();
      mocks.read.mockResolvedValue(null);

      yield* startMaterialPlacement(store, { ctx: HINT, locale: "en", page });

      expect(store.getState().placement).toStrictEqual(Option.none());
    })
  );

  for (const ctx of [undefined, "", "merdeka"]) {
    it.effect(
      `asks nothing and drops an earlier placement for the hint ${String(ctx)}`,
      () =>
        Effect.gen(function* () {
          const store = createPlacementStore();
          store.setState({ placement: Option.some(placement) });

          yield* startMaterialPlacement(store, { ctx, locale: "en", page });

          expect(store.getState().placement).toStrictEqual(Option.none());
          expect(mocks.read).not.toHaveBeenCalled();
        })
    );
  }

  it.effect("reports a failed read and keeps the lesson's own links", () =>
    Effect.gen(function* () {
      const store = createPlacementStore();
      const cause = new Error("offline");
      mocks.read.mockRejectedValue(cause);
      mocks.report.mockReturnValue(Effect.void);

      yield* startMaterialPlacement(store, { ctx: HINT, locale: "en", page });

      expect(store.getState().placement).toStrictEqual(Option.none());
      expect(mocks.report).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ _tag: "PlacementReadFailed", cause }),
        { source: "material-placement" }
      );
    })
  );
});
