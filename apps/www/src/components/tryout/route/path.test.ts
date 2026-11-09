import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutAttemptLock,
  getTryoutCrumbTarget,
  getTryoutHref,
  getTryoutPageHref,
  getTryoutPageTarget,
  getTryoutPracticeAuthHref,
  getTryoutPracticeTarget,
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
        group: "sma-ma-smk",
        section: "matematika-wajib",
        set: "set-1",
        track: "matematika-wajib",
      })
    ).toBe(
      "/try-out/indonesia/tka/sma-ma-smk/matematika-wajib/set-1/matematika-wajib"
    );
    expect(getTryoutPublicPathHref("try-out/indonesia/tka")).toBe(
      "/try-out/indonesia/tka"
    );
    expect(getTryoutAttemptLock("attempt/id", 42)).toEqual({
      name: "attemptId",
      until: 42,
      value: "attempt/id",
    });
    expect(getTryoutAttemptHref("try-out/id/set-1/section", "attempt/id")).toBe(
      "/try-out/id/set-1/section?attemptId=attempt%2Fid"
    );
    expect(
      getTryoutAttemptHref(
        "try-out/id/set-1/section",
        "attempt/id",
        Option.some("single")
      )
    ).toBe("/try-out/id/set-1/section?attemptId=attempt%2Fid&view=single");
    expect(
      getTryoutAttemptAuthHref("id", "try-out/id/set-1/section", "attempt/id")
    ).toBe(
      "/id/auth?redirect=%2Fid%2Ftry-out%2Fid%2Fset-1%2Fsection%3FattemptId%3Dattempt%252Fid"
    );
    expect(
      getTryoutAttemptAuthHref(
        "id",
        "try-out/id/set-1/section",
        "attempt/id",
        Option.some("single")
      )
    ).toBe(
      "/id/auth?redirect=%2Fid%2Ftry-out%2Fid%2Fset-1%2Fsection%3FattemptId%3Dattempt%252Fid%26view%3Dsingle"
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
    expect(routeOf("try-out/indonesia/snbt")).toEqual(Option.none());
    expect(routeOf("try-out/indonesia/snbt/2027")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$group")
    );
    expect(routeOf("try-out/indonesia/snbt/2027/utbk")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$group/$track")
    );
    expect(routeOf("try-out/indonesia/snbt/2027/utbk/set-1")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$group/$track/$set")
    );
    expect(routeOf("try-out/indonesia/snbt/2027/utbk/set-1/section-1")).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$group/$track/$set/$section")
    );
    expect(Option.isNone(getTryoutPublicPathTarget("try-out//snbt"))).toBe(
      true
    );
    expect(
      Option.isNone(
        getTryoutPublicPathTarget("try-out/indonesia/snbt/2027/utbk/set-1/a/b")
      )
    ).toBe(true);
  });

  it("binds a set or a section to its attempt, and a page of another shape to none", () => {
    expect(
      Option.map(
        getTryoutPageTarget({
          attemptId: "attempt-1",
          publicPath: "try-out/indonesia/snbt/2027/utbk/set-1",
        }),
        (target) => [target.to, target.search]
      )
    ).toEqual(
      Option.some([
        "/$locale/try-out/$country/$exam/$group/$track/$set",
        { attemptId: "attempt-1" },
      ])
    );
    expect(
      Option.map(
        getTryoutPageTarget({
          attemptId: "attempt-1",
          publicPath: "try-out/indonesia/snbt/2027/utbk/set-1/section-1",
        }),
        (target) => target.to
      )
    ).toEqual(
      Option.some("/$locale/try-out/$country/$exam/$group/$track/$set/$section")
    );
    expect(
      Option.isNone(
        getTryoutPageTarget({
          attemptId: "attempt-1",
          publicPath: "try-out/indonesia/snbt/2027/utbk",
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
    expect(
      Option.isSome(getTryoutCrumbTarget("try-out/indonesia/snbt/2027"))
    ).toBe(true);
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

describe("getTryoutPracticeTarget", () => {
  it("opens the practice of a set or a section, and of nothing else", () => {
    expect(
      getTryoutPracticeTarget("try-out/indonesia/snbt/2027/utbk/set-1")
    ).toEqual(
      Option.some({
        from: "/$locale",
        params: {
          country: "indonesia",
          exam: "snbt",
          group: "2027",
          set: "set-1",
          track: "utbk",
        },
        search: { mode: "practice" },
        to: "/$locale/try-out/$country/$exam/$group/$track/$set",
      })
    );
    expect(
      getTryoutPracticeTarget("try-out/indonesia/snbt/2027/utbk/set-1/verbal")
    ).toEqual(
      Option.some({
        from: "/$locale",
        params: {
          country: "indonesia",
          exam: "snbt",
          group: "2027",
          section: "verbal",
          set: "set-1",
          track: "utbk",
        },
        search: { mode: "practice" },
        to: "/$locale/try-out/$country/$exam/$group/$track/$set/$section",
      })
    );
    expect(getTryoutPracticeTarget("try-out/indonesia/snbt/2027/utbk")).toEqual(
      Option.none()
    );
  });
});

describe("getTryoutPracticeAuthHref", () => {
  it("signs in and comes back to the practice", () => {
    expect(
      getTryoutPracticeAuthHref("id", "try-out/indonesia/snbt/2027/utbk/set-1")
    ).toBe(
      `/id/auth?redirect=${encodeURIComponent("/id/try-out/indonesia/snbt/2027/utbk/set-1?mode=practice")}`
    );
  });
});
