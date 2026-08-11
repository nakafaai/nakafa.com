import { describe, expect, it } from "vitest";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  hasTryoutAttemptCapability,
  readTryoutAttemptCapability,
  readTryoutRouteAttemptCapability,
} from "@/components/tryout/route/path";

describe("tryout route paths", () => {
  it("builds public hierarchy and snapshot-bound hrefs", () => {
    expect(getTryoutHref()).toBe("/try-out");
    expect(
      getTryoutHref({
        country: "indonesia",
        exam: "tka",
        section: "matematika",
        set: "set-1",
        track: "2027",
      })
    ).toBe("/try-out/indonesia/tka/2027/set-1/matematika");
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
    expect(
      readTryoutAttemptCapability(new URLSearchParams("attemptId=attempt-id"))
    ).toEqual({ attemptId: "attempt-id", kind: "valid" });
    expect(hasTryoutAttemptCapability(new URLSearchParams())).toBe(false);
    expect(readTryoutAttemptCapability(new URLSearchParams())).toEqual({
      kind: "absent",
    });
    expect(hasTryoutAttemptCapability(new URLSearchParams("attemptId="))).toBe(
      false
    );
    expect(
      hasTryoutAttemptCapability(
        new URLSearchParams("attemptId=first&attemptId=second")
      )
    ).toBe(false);
    expect(
      readTryoutAttemptCapability(
        new URLSearchParams("attemptId=first&attemptId=second")
      )
    ).toEqual({ kind: "invalid" });
  });
});
