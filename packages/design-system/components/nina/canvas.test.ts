import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  BLINK_DURATION,
  blinkScale,
  drawFrame,
  POP_DURATION,
  popProgress,
  readPalette,
} from "@repo/design-system/components/nina/canvas";
import type { Canvas2D } from "@repo/design-system/components/nina/draw";
import {
  applyTransform,
  createCache,
} from "@repo/design-system/components/nina/draw";
import { NINA, POP } from "@repo/mascot/color";
import { frame, start } from "@repo/mascot/nina/life";
import type { Options } from "@repo/mascot/nina/options";
import {
  circle,
  ellipse,
  group,
  path,
  polygon,
  rect,
} from "@repo/mascot/shape";
import { MutableHashMap, MutableList } from "effect";

const LOWEST = () => 0;

/** Records Canvas 2D drawing commands so tests can verify exact transforms, fills, strokes and effects. */
function fakeContext() {
  const calls = MutableList.make<string>();
  const dashes = MutableList.make<readonly number[]>();
  const ellipses =
    MutableList.make<readonly [number, number, number, number]>();
  const ctx: Canvas2D = {
    arc: () => {
      MutableList.append(calls, "arc");
    },
    beginPath: () => {
      MutableList.append(calls, "beginPath");
    },
    clearRect: () => {
      MutableList.append(calls, "clearRect");
    },
    closePath: () => {
      MutableList.append(calls, "closePath");
    },
    ellipse: (cx: number, cy: number, rx: number, ry: number) => {
      MutableList.append(calls, "ellipse");
      MutableList.append(ellipses, [cx, cy, rx, ry]);
    },
    fill: () => {
      MutableList.append(calls, "fill");
    },
    fillRect: () => {
      MutableList.append(calls, "fillRect");
    },
    fillStyle: "",
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    lineTo: () => {
      MutableList.append(calls, "lineTo");
    },
    lineWidth: 1,
    moveTo: () => {
      MutableList.append(calls, "moveTo");
    },
    quadraticCurveTo: () => {
      MutableList.append(calls, "quadraticCurveTo");
    },
    rect: () => {
      MutableList.append(calls, "rect");
    },
    restore: () => {
      MutableList.append(calls, "restore");
    },
    rotate: (angle: number) => {
      MutableList.append(calls, `rotate:${angle.toFixed(3)}`);
    },
    roundRect: () => {
      MutableList.append(calls, "roundRect");
    },
    save: () => {
      MutableList.append(calls, "save");
    },
    scale: (sx: number, sy: number) => {
      MutableList.append(calls, `scale:${sx},${sy}`);
    },
    setLineDash: (pattern: Iterable<number>) => {
      MutableList.append(calls, "setLineDash");
      MutableList.append(dashes, [...pattern]);
    },
    setTransform: () => {
      MutableList.append(calls, "setTransform");
    },
    stroke: () => {
      MutableList.append(calls, "stroke");
    },
    strokeStyle: "",
    translate: (x: number, y: number) => {
      MutableList.append(calls, `translate:${x},${y}`);
    },
  };
  return {
    calls: () => MutableList.toArray(calls),
    ctx,
    dashes: () => MutableList.toArray(dashes),
    ellipses: () => MutableList.toArray(ellipses),
  };
}

class FakePath2D {
  readonly d: string;
  constructor(d: string) {
    this.d = d;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("blinkScale and popProgress", () => {
  it("squashes open eyes to 0.1 at mid-blink and restores them outside the window", () => {
    expect(blinkScale(-10)).toBe(1);
    expect(blinkScale(0)).toBe(1);
    expect(blinkScale(BLINK_DURATION)).toBe(1);
    expect(blinkScale(BLINK_DURATION + 20)).toBe(1);
    expect(blinkScale(BLINK_DURATION * 0.25)).toBeLessThan(1);
    expect(blinkScale(BLINK_DURATION * 0.5)).toBeCloseTo(0.1, 6);
    expect(blinkScale(BLINK_DURATION * 0.75)).toBeLessThan(1);
  });

  it("eases a held item pop from 0 to 1 over POP_DURATION", () => {
    expect(popProgress(-5)).toBe(0);
    expect(popProgress(0)).toBe(0);
    expect(popProgress(POP_DURATION / 2)).toBeGreaterThan(0.5);
    expect(popProgress(POP_DURATION / 2)).toBeLessThan(1);
    expect(popProgress(POP_DURATION)).toBe(1);
    expect(popProgress(POP_DURATION + 50)).toBe(1);
  });
});

describe("readPalette", () => {
  it("reads CSS tokens from computed styles and falls back to flat defaults when unset", () => {
    const element = document.createElement("canvas");
    element.style.setProperty("--color-nina-body", "#123456");
    element.style.color = "rgb(10, 20, 30)";
    document.body.append(element);

    const palette = readPalette(element);
    expect(palette.tokens[NINA.body]).toBe("#123456");
    expect(palette.tokens[NINA.face]).toBe(NINA.face);
    expect(palette.tokens[POP.yellow]).toBe(POP.yellow);
    expect(palette.text).toBe("rgb(10, 20, 30)");
    element.remove();

    const bare = document.createElement("canvas");
    vi.spyOn(window, "getComputedStyle").mockReturnValue(bare.style);
    const fallback = readPalette(bare);
    expect(fallback.text).toBe(fallback.tokens[NINA.ink]);
  });
});

describe("applyTransform", () => {
  it("applies translate, single and pivoted rotate, uniform and non-uniform scale, and ignores unknown transforms", () => {
    const { calls, ctx } = fakeContext();
    applyTransform(
      ctx,
      "translate(10 20) translate() rotate(90) rotate(45 5 6) rotate() scale(2) scale(2 -1) scale() skew(10)"
    );
    const list = calls();
    expect(list).toContain("translate:10,20");
    expect(list).toContain("translate:0,0");
    expect(list).toContain("translate:5,6");
    expect(list).toContain("translate:-5,-6");
    expect(list).toContain("scale:2,2");
    expect(list).toContain("scale:2,-1");
    expect(list).toContain("scale:1,1");
  });
});

describe("drawFrame", () => {
  it("draws whole, peek, mirrored, tile, blinking, popping and complex shapes onto a 2D canvas", () => {
    vi.stubGlobal("Path2D", FakePath2D);
    const element = document.createElement("canvas");
    const palette = readPalette(element);
    const cache = createCache();

    const cases: readonly Options[] = [
      { act: "relaxed", whole: true },
      { act: "reading", side: "left", whole: true },
      { act: "painting", whole: true },
      { act: "pointing", mood: "confused", whole: true },
      { act: "cheering", whole: true },
      { act: "gripping", lean: "peek" },
      { lean: "right", mood: "surprised", tile: "cream" },
      { lean: "center", mood: "thoughtful" },
    ];

    for (const options of cases) {
      const { calls, ctx } = fakeContext();
      const snapshot = frame(start(options, LOWEST), options);
      drawFrame(
        ctx,
        snapshot,
        palette,
        cache,
        { eyeScaleY: 0.5, heldPop: 0.5 },
        240,
        248
      );
      expect(calls()).toContain("clearRect");
      expect(calls()).toContain("fill");
    }

    // Reuses cached Path2D instances across subsequent frames, and covers settled held props (`heldPop = 1`).
    const cachedCount = MutableHashMap.size(cache.paths);
    const { ctx: second } = fakeContext();
    drawFrame(
      second,
      frame(start({ act: "reading", whole: true }, LOWEST), {
        act: "reading",
        whole: true,
      }),
      palette,
      cache,
      { eyeScaleY: 1, heldPop: 1 },
      240,
      248
    );
    expect(MutableHashMap.size(cache.paths)).toBe(cachedCount);
  });

  it("handles polygons, rounded and plain rects, stroke-only shapes, pathLength scaling, fillRule and groups with opacity/color", () => {
    vi.stubGlobal("Path2D", FakePath2D);
    const origCreate = document.createElementNS.bind(document);
    let hasTotalLength = true;
    vi.spyOn(document, "createElementNS").mockImplementation(
      (ns: string | null, tag: string) => {
        const node = origCreate(ns, tag);
        if (tag === "path" && hasTotalLength) {
          Reflect.set(node, "getTotalLength", () => 50);
        }
        return node;
      }
    );

    const palette = readPalette(document.createElement("canvas"));
    const cache = createCache();
    const base = frame(start({ act: "relaxed", whole: true }, LOWEST), {
      act: "relaxed",
      whole: true,
    });
    const customSnapshot = {
      ...base,
      pose: {
        ...base.pose,
        above: [
          group(
            [
              circle({ cx: 10, cy: 10, fill: "currentColor", r: 4 }),
              ellipse({
                cx: 20,
                cy: 20,
                fill: "none",
                rx: 5,
                ry: 3,
                stroke: "currentColor",
              }),
              rect({ fill: NINA.body, height: 10, rx: 3, width: 12 }),
              rect({ fill: NINA.face, height: 8, width: 8, x: 4, y: 5 }),
              polygon({ fill: POP.red, points: "0,0 10,0 5,10" }),
              polygon({ fill: POP.red, points: "bad" }),
              path({
                d: "M0,0 L50,0",
                fill: "none",
                pathLength: 1,
                stroke: POP.blue,
                strokeDasharray: "0.5 1",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeOpacity: 0.8,
                strokeWidth: 3,
              }),
              path({
                d: "M0,10 L20,10",
                fill: NINA.body,
                fillOpacity: 0.6,
                fillRule: "evenodd",
                stroke: "none",
                strokeDasharray: "2 4",
              }),
              path({
                d: "M0,20 L20,20",
                fill: "none",
                stroke: POP.green,
                strokeDasharray: "2 4",
              }),
            ],
            { color: POP.orange, opacity: 0.9, transform: "translate(1 2)" }
          ),
        ],
        layer: ["front", "front"] as const,
      },
    };

    const { calls, ctx, dashes } = fakeContext();
    drawFrame(
      ctx,
      customSnapshot,
      palette,
      cache,
      { eyeScaleY: 0.2, heldPop: 1 },
      200,
      206
    );
    expect(calls()).toContain("roundRect");
    expect(calls()).toContain("rect");
    expect(calls()).toContain("arc");
    expect(calls()).toContain("stroke");
    // pathLength=1 with totalLength=50 scales "0.5 1" -> [25, 50].
    expect(dashes()).toContainEqual([25, 50]);
    expect(dashes()).toContainEqual([2, 4]);

    // When getTotalLength is unavailable (returns 0), falls back to unscaled dash length.
    hasTotalLength = false;
    const freshCache = createCache();
    const { ctx: noLenCtx, dashes: noLenDashes } = fakeContext();
    drawFrame(
      noLenCtx,
      customSnapshot,
      palette,
      freshCache,
      { eyeScaleY: 1, heldPop: 1 },
      200,
      206
    );
    expect(noLenDashes()).toContainEqual([0.5, 1]);
  });
});
