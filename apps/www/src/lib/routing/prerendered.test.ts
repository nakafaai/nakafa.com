import { describe, expect, it } from "@effect/vitest";
import { namesLearnerPage, staticPagePath } from "@/lib/routing/prerendered";

const TRACK = "/en/try-out/indonesia/snbt/2027";

describe("learner pages", () => {
  it("names a try-out track, set and section, and no file beside them", () => {
    expect(namesLearnerPage(TRACK)).toBe(true);
    expect(namesLearnerPage(`${TRACK}/set-1`)).toBe(true);
    expect(namesLearnerPage(`${TRACK}/set-1/general-reasoning`)).toBe(true);
    expect(namesLearnerPage(`${TRACK}/set-1.md`)).toBe(false);
    expect(namesLearnerPage("/en/try-out/indonesia/snbt")).toBe(false);
    expect(namesLearnerPage("/en/articles/politics/belajar")).toBe(false);
  });

  it("writes a learner page in its own folder, and every other page at its path", () => {
    expect(staticPagePath(`${TRACK}/set-1`)).toBe(`/_tryout${TRACK}/set-1`);
    expect(staticPagePath("/en/try-out/indonesia")).toBe(
      "/en/try-out/indonesia"
    );
    expect(staticPagePath("/id")).toBe("/id");
  });
});
