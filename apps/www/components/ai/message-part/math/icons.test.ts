import { mathOperations } from "@repo/math/schema/operations";
import { describe, expect, it } from "vitest";

import { getMathIcon } from "./icons";

describe("getMathIcon", () => {
  it("uses one unique icon for each math operation", () => {
    const icons = mathOperations.map(getMathIcon);

    expect(new Set(icons).size).toBe(mathOperations.length);
  });
});
