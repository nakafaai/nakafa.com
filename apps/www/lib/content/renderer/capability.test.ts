// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  createComponentCapability,
  createComponentRequirements,
  createDomainCapability,
} from "@/lib/content/renderer/capability";

describe("renderer capability", () => {
  it("assigns one version to canonical checked component names", () => {
    expect(createComponentRequirements(["Zulu", "Alpha"], 2)).toEqual([
      { name: "Alpha", version: 2 },
      { name: "Zulu", version: 2 },
    ]);
  });

  it("keeps current authoring separate from backward runtime support", () => {
    expect(
      createComponentCapability({
        authoringComponents: [{ name: "Alpha", version: 2 }],
        supportedComponents: [
          { name: "Alpha", version: 2 },
          { name: "Alpha", version: 1 },
        ],
      })
    ).toEqual({
      authoringComponents: [{ name: "Alpha", version: 2 }],
      supportedComponents: [
        { name: "Alpha", version: 1 },
        { name: "Alpha", version: 2 },
      ],
    });
  });

  it("keeps an empty physical route domain explicit", () => {
    expect(
      createDomainCapability("biology", {
        authoringComponents: [],
        supportedComponents: [],
      })
    ).toEqual({
      authoringComponents: [],
      name: "biology",
      supportedComponents: [],
    });
  });
});
