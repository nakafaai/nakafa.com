// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { activeMuscleAt } from "@repo/design-system/components/contents/biology/locomotion/model";

describe("animal locomotion lab model", () => {
  it("alternates each animal's antagonistic muscle pair across the movement cycle", () => {
    expect(activeMuscleAt("earthworm", 0.2)).toBe("circular");
    expect(activeMuscleAt("earthworm", 0.7)).toBe("longitudinal");
    expect(activeMuscleAt("fish", 0.1)).toBe("left");
    expect(activeMuscleAt("fish", 0.8)).toBe("right");
    expect(activeMuscleAt("grasshopper", 0.25)).toBe("flexor");
    expect(activeMuscleAt("grasshopper", 0.75)).toBe("extensor");
    expect(activeMuscleAt("bird", 0.3)).toBe("pectoralis");
    expect(activeMuscleAt("bird", 0.9)).toBe("supracoracoideus");
  });
});
