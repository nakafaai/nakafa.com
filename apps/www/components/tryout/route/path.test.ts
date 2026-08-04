import { describe, expect, it } from "vitest";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  readTryoutAttemptId,
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

  it("accepts only one non-empty attempt capability", () => {
    expect(readTryoutAttemptId({ attemptId: "attempt-id" })).toBe("attempt-id");
    expect(readTryoutAttemptId({})).toBeUndefined();
    expect(readTryoutAttemptId({ attemptId: "" })).toBeUndefined();
    expect(
      readTryoutAttemptId({ attemptId: ["first", "second"] })
    ).toBeUndefined();
  });
});
