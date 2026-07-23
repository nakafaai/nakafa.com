// @vitest-environment node

import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { describe, expect, it } from "vitest";
import {
  type MaterialStaticParam,
  partitionMaterialStaticParams,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/params";

const DOMAINS = [
  "biology",
  "chemistry",
  "mathematics",
] as const satisfies readonly RendererDomain[];

/** Creates ordered candidates large enough to cross the global route cap. */
function makeParams(count: number): readonly MaterialStaticParam[] {
  return Array.from({ length: count }, (_, index) => {
    const rendererDomain = DOMAINS[index % DOMAINS.length] ?? "biology";

    return {
      lesson: [`lesson-${index}`],
      rendererDomain,
      subject: rendererDomain,
      topic: `topic-${index}`,
    };
  });
}

/** Returns the stable candidate identity used to detect route duplication. */
function toIdentity(param: MaterialStaticParam) {
  return `${param.subject}/${param.topic}/${param.lesson.join("/")}`;
}

describe("material static params", () => {
  it("partitions one globally bounded selection without duplicate routes", () => {
    const source = makeParams(600);
    const partitions = partitionMaterialStaticParams(source);
    const selected = [
      ...partitions.generic,
      ...partitions.chemistry,
      ...partitions.mathematics,
    ];
    const identities = selected.map(toIdentity);

    expect(selected).toHaveLength(512);
    expect(new Set(identities)).toHaveProperty("size", 512);
    expect(new Set(identities)).toEqual(
      new Set(source.slice(0, 512).map(toIdentity))
    );
    expect(
      partitions.generic.every((item) => item.rendererDomain === "biology")
    ).toBe(true);
    expect(
      partitions.chemistry.every((item) => item.rendererDomain === "chemistry")
    ).toBe(true);
    expect(
      partitions.mathematics.every(
        (item) => item.rendererDomain === "mathematics"
      )
    ).toBe(true);
  });
});
