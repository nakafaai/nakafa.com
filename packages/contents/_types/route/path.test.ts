import {
  InvalidPublicRouteSourceError,
  MissingPublicSlugError,
} from "@repo/contents/_types/route/error";
import {
  comparePublicRouteOrder,
  getParentPath,
  lookupNamespaceSegment,
  makePath,
  readPathWithoutNamespace,
} from "@repo/contents/_types/route/path";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public route path helpers", () => {
  it("reads route hierarchy and deterministic ordering from decoded paths", () => {
    expect(getParentPath("materi/matematika/integral/jumlahan-riemann")).toBe(
      "materi/matematika/integral"
    );
    expect(readPathWithoutNamespace("materi/matematika/integral")).toBe(
      "matematika/integral"
    );
    expect(
      comparePublicRouteOrder(
        { order: 2, publicPath: Effect.runSync(makePath(["materi", "b"])) },
        { order: 1, publicPath: Effect.runSync(makePath(["materi", "a"])) }
      )
    ).toBeGreaterThan(0);
    expect(
      comparePublicRouteOrder(
        { order: 1, publicPath: Effect.runSync(makePath(["materi", "b"])) },
        { order: 1, publicPath: Effect.runSync(makePath(["materi", "a"])) }
      )
    ).toBeGreaterThan(0);
    expect(
      comparePublicRouteOrder(
        { publicPath: Effect.runSync(makePath(["materi", "b"])) },
        { publicPath: Effect.runSync(makePath(["materi", "a"])) }
      )
    ).toBeGreaterThan(0);
  });

  it("maps invalid route segments to the typed route error", () => {
    const error = Effect.runSync(Effect.flip(makePath(["Not A Segment"])));

    expect(error).toBeInstanceOf(InvalidPublicRouteSourceError);
  });

  it("fails with a typed error when a namespace source is missing", async () => {
    vi.spyOn(PUBLIC_ROUTE_SURFACES, "find").mockReturnValueOnce(undefined);

    const error = await Effect.runPromise(
      Effect.flip(lookupNamespaceSegment("subject", "en"))
    );

    expect(error).toBeInstanceOf(MissingPublicSlugError);
  });
});
