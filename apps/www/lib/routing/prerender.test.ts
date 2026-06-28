import { describe, expect, it } from "vitest";
import {
  readLearningStaticParamLimit,
  selectLearningStaticParams,
} from "@/lib/routing/prerender";

describe("learning route prerender selection", () => {
  it("keeps generated static params bounded while preserving source order", () => {
    const params = Array.from(
      { length: readLearningStaticParamLimit() + 1 },
      (_, index) => ({ slug: `route-${index}` })
    );

    expect(selectLearningStaticParams(params)).toHaveLength(
      readLearningStaticParamLimit()
    );
    expect(selectLearningStaticParams(params).at(0)).toEqual({
      slug: "route-0",
    });
    expect(selectLearningStaticParams(params).at(-1)).toEqual({
      slug: `route-${readLearningStaticParamLimit() - 1}`,
    });
  });
});
