import { describe, expect, it } from "vitest";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

const EXPECTED_STATIC_PARAM_LIMIT = 512;

describe("learning route prerender selection", () => {
  it("keeps generated static params bounded while preserving source order", () => {
    const params = Array.from(
      { length: EXPECTED_STATIC_PARAM_LIMIT + 100 },
      (_, index) => ({ slug: `route-${index}` })
    );

    expect(selectLearningStaticParams(params)).toHaveLength(
      EXPECTED_STATIC_PARAM_LIMIT
    );
    expect(selectLearningStaticParams(params).at(0)).toEqual({
      slug: "route-0",
    });
    expect(selectLearningStaticParams(params).at(-1)).toEqual({
      slug: "route-511",
    });
  });
});
