import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutCrumbTarget,
  getTryoutHref,
  getTryoutPageHref,
  getTryoutPageTarget,
  getTryoutPublicPathHref,
  getTryoutPublicPathTarget,
  hasTryoutAttemptCapability,
  readTryoutRouteAttemptCapability,
} from "@/components/tryout/route/path";

describe("tryout route paths", () => {
  it("builds public hierarchy and snapshot-bound hrefs", () => {
    expect(getTryoutHref()).toBe("/try-out");
    expect(
      getTryoutHref({
        country: "indonesia",
        exam: "tka",
        section: "matematika-wajib",
        set: "set-1",
        track: "matematika-wajib",
      })
    ).toBe("/try-out/indonesia/tka/matematika-wajib/set-1/matematika-wajib");
    expect(getTryoutPublicPathHref("try-out/indonesia/tka")).toBe(
      "/try-out/indonesia/tka"
    );
    expect(getTryoutAttemptHref("try-out/id/set-1/section", "attempt/id")).toBe(
      "/try-out/id/set-1/section?attemptId=attempt%2Fid"
    );
    expect(
      getTryoutAttemptAuthHref("id", "try-out/id/set-1/section", "attempt/id")
    ).toBe(
      "/id/auth?redirect=%2Fid%2Ftry-out%2Fid%2Fset-1%2Fsection%3FattemptId%3Dattempt%252Fid"
    );
  });

  it("classifies server attempt capabilities without accepting ambiguity", () => {
    expect(
      readTryoutRouteAttemptCapability({ attemptId: "attempt-id" })
    ).toEqual({ attemptId: "attempt-id", kind: "valid" });
    expect(readTryoutRouteAttemptCapability({})).toEqual({ kind: "absent" });
    expect(readTryoutRouteAttemptCapability({ attemptId: "" })).toEqual({
      kind: "invalid",
    });
    expect(
      readTryoutRouteAttemptCapability({ attemptId: ["first", "second"] })
    ).toEqual({ kind: "invalid" });
  });

  it("accepts only one non-empty browser attempt capability", () => {
    expect(
      hasTryoutAttemptCapability(new URLSearchParams("attemptId=attempt-id"))
    ).toBe(true);
    expect(hasTryoutAttemptCapability(new URLSearchParams())).toBe(false);
    expect(hasTryoutAttemptCapability(new URLSearchParams("attemptId="))).toBe(
      false
    );
    expect(
      hasTryoutAttemptCapability(
        new URLSearchParams("attemptId=first&attemptId=second")
      )
    ).toBe(false);
  });

  it("types a country path as its route target and refuses any other shape", () => {
    expect(getTryoutPublicPathTarget("try-out/indonesia")).toEqual(
      Option.some({
        from: "/$locale",
        params: { country: "indonesia" },
        to: "/$locale/try-out/$country",
      })
    );
    expect(
      Option.isNone(getTryoutPublicPathTarget("curricula/indonesia"))
    ).toBe(true);
  });

  it("names each try-out depth as its own route, and no malformed shape", () => {
    const routeOf = (publicPath: string) =>
      Option.map(getTryoutPublicPathTarget(publicPath), (target) => target.to);

    expect(routeOf("try-out")).toEqual(Option.some("/$locale/try-out"));
    expect(routeOf("try-out/indonesia/snbt")).toEqual(
      Option.some("/$locale/try-out/$country/$exam")
    );
    expect(routeOf("try-out/indonesia/snbt/2027")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$track")
    );
    expect(routeOf("try-out/indonesia/snbt/2027/set-1")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$track/$set")
    );
    expect(routeOf("try-out/indonesia/snbt/2027/set-1/section-1")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$track/$set/$section")
    );
    expect(Option.isNone(getTryoutPublicPathTarget("try-out//snbt"))).toBe(
      true
    );
    expect(
      Option.isNone(
        getTryoutPublicPathTarget("try-out/indonesia/snbt/2027/set-1/a/b")
      )
    ).toBe(true);
  });

  it("binds a set or a section to its attempt, and a page of another shape to none", () => {
    expect(
      Option.map(
        getTryoutPageTarget({
          attemptId: "attempt-1",
          publicPath: "try-out/indonesia/snbt/2027/set-1",
        }),
        (target) => [target.to, target.search]
      )
    ).toEqual(
      Option.some([
        "/$locale/try-out/$country/$exam/$track/$set",
        { attemptId: "attempt-1" },
      ])
    );
    expect(
      Option.map(
        getTryoutPageTarget({
          attemptId: "attempt-1",
          publicPath: "try-out/indonesia/snbt/2027/set-1/section-1",
        }),
        (target) => target.to
      )
    ).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$track/$set/$section")
    );
    expect(
      Option.isNone(
        getTryoutPageTarget({
          attemptId: "attempt-1",
          publicPath: "try-out/indonesia/snbt",
        })
      )
    ).toBe(true);
    expect(
      Option.isSome(
        getTryoutPageTarget({ publicPath: "try-out/indonesia/snbt/2027" })
      )
    ).toBe(true);
  });

  it("builds the catalog href when no route coordinate is given", () => {
    expect(getTryoutHref()).toBe("/try-out");
  });

  it("gives a breadcrumb the target of its try-out page and builds the page href with its attempt", () => {
    expect(Option.isSome(getTryoutCrumbTarget("try-out/indonesia/snbt"))).toBe(
      true
    );
    expect(getTryoutPageHref({ publicPath: "try-out/indonesia" })).toBe(
      "/try-out/indonesia"
    );
    expect(
      getTryoutPageHref({
        attemptId: "attempt-1",
        publicPath: "try-out/indonesia",
      })
    ).toBe("/try-out/indonesia?attemptId=attempt-1");
  });
});
