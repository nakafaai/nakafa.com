import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedLocalizedHref } from "@/lib/routing/locale/published";
import { previewIdProjection, previewProjection } from "@/test/content-preview";
import {
  readTestPublishedRoute,
  testProgramSubject,
} from "@/test/content-program";

const publishedMocks = vi.hoisted(() => ({
  materialContext: vi.fn(),
  materialRoute: vi.fn(),
  programRoute: vi.fn(),
  tryoutPath: vi.fn(),
}));
const activeReleaseId = ReleaseIdSchema.make("material-release");
const idProgramSubject = readTestPublishedRoute(
  "kurikulum/merdeka/kelas-11/matematika",
  "id"
);

vi.mock("@/lib/content/material/context", () => ({
  readPublishedMaterialContext: publishedMocks.materialContext,
}));
vi.mock("@/lib/content/material/route", () => ({
  readPublishedMaterialRoute: publishedMocks.materialRoute,
}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: publishedMocks.programRoute,
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: publishedMocks.tryoutPath,
}));

beforeEach(() => {
  publishedMocks.materialContext.mockReset();
  publishedMocks.materialRoute.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId,
      alternates: [previewProjection, previewIdProjection],
      projection: previewProjection,
    })
  );
  publishedMocks.programRoute.mockReset().mockReturnValue(
    Effect.succeed({
      alternates: [testProgramSubject, idProgramSubject],
      route: testProgramSubject,
    })
  );
  publishedMocks.tryoutPath.mockReset().mockReturnValue(Effect.succeed(null));
});

/** Reads one English material route through its Indonesian signed target. */
function readMaterialHref(search = "") {
  return Effect.runSync(
    readPublishedLocalizedHref({
      currentLocale: "en",
      locale: "id",
      publicPath: previewProjection.publicPath,
      search,
    })
  );
}

describe("published localized route ownership", () => {
  it("projects a material route through signed locale counterparts", () => {
    expect(readMaterialHref()).toBe(`/${previewIdProjection.publicPath}`);
    expect(publishedMocks.materialRoute).toHaveBeenCalledWith(
      "en",
      previewProjection.publicPath
    );
  });

  it("keeps only backend-verified material context", () => {
    const search =
      "?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
    publishedMocks.materialContext
      .mockReturnValueOnce(Effect.succeed({ context: {} }))
      .mockReturnValueOnce(Effect.succeed(null));

    expect(readMaterialHref(search)).toBe(
      `/${previewIdProjection.publicPath}${search}`
    );
    expect(readMaterialHref(search)).toBe(`/${previewIdProjection.publicPath}`);
  });

  it("fails closed for material tombstones and missing counterparts", () => {
    publishedMocks.materialRoute
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          alternates: [],
          projection: null,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          alternates: [previewProjection],
          projection: previewProjection,
        })
      );

    expect(() => readMaterialHref()).toThrow();
    expect(() => readMaterialHref()).toThrow();
  });

  it("projects signed curriculum counterparts and ignores other surfaces", () => {
    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          locale: "id",
          publicPath: testProgramSubject.publicPath,
          search: "",
        })
      )
    ).toBe(`/${idProgramSubject.publicPath}`);
    expect(
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          locale: "id",
          publicPath: "articles/example",
          search: "",
        })
      )
    ).toBeNull();
  });

  it("projects signed try-out counterparts and fails closed for tombstones", () => {
    publishedMocks.tryoutPath
      .mockReturnValueOnce(
        Effect.succeed(
          "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
        )
      )
      .mockReturnValueOnce(Effect.succeed(null));
    const read = () =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "id",
          locale: "en",
          publicPath:
            "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
          search: "",
        })
      );

    expect(read()).toBe(
      "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
    );
    expect(read).toThrow();
  });

  it("fails closed for curriculum tombstones and missing counterparts", () => {
    publishedMocks.programRoute
      .mockReturnValueOnce(Effect.succeed({ alternates: [], route: null }))
      .mockReturnValueOnce(
        Effect.succeed({
          alternates: [testProgramSubject],
          route: testProgramSubject,
        })
      );
    const read = () =>
      Effect.runSync(
        readPublishedLocalizedHref({
          currentLocale: "en",
          locale: "id",
          publicPath: testProgramSubject.publicPath,
          search: "",
        })
      );

    expect(read).toThrow();
    expect(read).toThrow();
  });
});
