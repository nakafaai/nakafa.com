import { describe, expect, it } from "@effect/vitest";
import { isPrerenderedRouteTarget } from "@/lib/routing/prerendered";

describe("prerendered route targets", () => {
  it("names the public content routes that load as documents", () => {
    expect(isPrerenderedRouteTarget("/$locale/articles/$category/$slug")).toBe(
      true
    );
    expect(isPrerenderedRouteTarget("/$locale/quran/$surah")).toBe(true);
    expect(isPrerenderedRouteTarget("/$locale/$")).toBe(true);
  });

  it("keeps the signed-in and attempt routes on the client router", () => {
    expect(
      isPrerenderedRouteTarget("/$locale/try-out/$country/$exam/$track")
    ).toBe(false);
    expect(
      isPrerenderedRouteTarget("/$locale/try-out/$country/$exam/$track/$set")
    ).toBe(false);
    expect(isPrerenderedRouteTarget("/$locale/chat")).toBe(false);
    expect(isPrerenderedRouteTarget(undefined)).toBe(false);
  });
});
