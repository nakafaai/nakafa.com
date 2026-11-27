// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { words } from "@repo/design-system/components/three/print/sheet";

describe("a text as most prints set one", () => {
  it("is bold sans-serif, centred on its anchor and upright", () => {
    expect(
      words({ at: [0, 0.01], ink: "ink", size: 0.004, text: "kPa" })
    ).toEqual({
      align: "middle",
      at: [0, 0.01],
      face: "sans",
      ink: "ink",
      kind: "text",
      size: 0.004,
      text: "kPa",
      turn: 0,
      weight: 700,
    });
  });

  it("keeps what the author says of it", () => {
    const set = words({
      align: "start",
      at: [0, 0],
      face: "mono",
      ink: "ink",
      size: 0.01,
      text: "pH 7.0",
      turn: 1,
      weight: 600,
    });
    expect(set).toMatchObject({
      align: "start",
      face: "mono",
      turn: 1,
      weight: 600,
    });
  });
});
