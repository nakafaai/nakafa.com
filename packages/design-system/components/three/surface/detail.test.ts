import { describe, expect, it } from "@effect/vitest";
import {
  BOARDS,
  paintDetail,
  SurfaceSchema,
} from "@repo/design-system/components/three/surface/detail";
import { Array as Arr } from "effect";

describe("paintDetail", () => {
  it.each(SurfaceSchema.literals)(
    "paints %s as opaque tone, normal and finish tiles",
    (surface) => {
      const { finish, normal, tone } = paintDetail(surface, 16);

      expect(tone).toHaveLength(16 * 16 * 4);
      expect(finish).toHaveLength(16 * 16 * 4);
      expect(normal).toHaveLength(16 * 16 * 4);
      expect(
        Arr.every(
          Arr.makeBy(16 * 16, (pixel) => tone[pixel * 4 + 3]),
          (alpha) => alpha === 255
        )
      ).toBe(true);
    }
  );

  it("varies a surface across its tile instead of painting one flat tone", () => {
    const { tone } = paintDetail("wood", 32);
    const shades = Arr.dedupe(Arr.makeBy(32 * 32, (pixel) => tone[pixel * 4]));

    expect(shades.length).toBeGreaterThan(20);
  });

  it("keeps rubber rougher than brushed metal", () => {
    const mean = (surface: "brushed" | "rubber") => {
      const { finish } = paintDetail(surface, 16);
      return (
        Arr.reduce(
          Arr.makeBy(16 * 16, (pixel) => finish[pixel * 4 + 1] ?? 0),
          0,
          (sum, value) => sum + value
        ) / 256
      );
    };

    expect(mean("rubber")).toBeGreaterThan(mean("brushed") + 80);
  });

  it("bends the light over bark far more than over moulded plastic", () => {
    const lean = (surface: "bark" | "plastic") => {
      const { normal } = paintDetail(surface, 32);
      return (
        Arr.reduce(
          Arr.makeBy(32 * 32, (pixel) =>
            Math.abs(Number(normal[pixel * 4]) - 127.5)
          ),
          0,
          (sum, value) => sum + value
        ) /
        (32 * 32)
      );
    };

    expect(lean("bark")).toBeGreaterThan(lean("plastic") * 4);
  });

  it("shades the furrows of bark and leaves smooth plastic open to the sky", () => {
    const darkest = (surface: "bark" | "plastic") => {
      const { finish } = paintDetail(surface, 32);
      return Math.min(
        ...Arr.makeBy(32 * 32, (pixel) => Number(finish[pixel * 4]))
      );
    };

    expect(darkest("bark")).toBeLessThan(200);
    expect(darkest("plastic")).toBeGreaterThan(240);
  });

  it("weaves cloth over and under: a thread on top slopes along itself, the next one across", () => {
    const { normal } = paintDetail("cloth", 256);
    const upward = (column: number, row: number) =>
      Math.abs(Number(normal[(row * 256 + column) * 4 + 1]) - 128);

    expect(upward(6, 1)).toBeGreaterThan(upward(2, 1) + 8);
    expect(upward(2, 5)).toBeGreaterThan(upward(6, 5) + 8);
  });

  it("lays planks as boards with a shaded groove where two meet", () => {
    const { finish } = paintDetail("planks", 64);
    const open = (row: number) =>
      Arr.reduce(
        Arr.makeBy(64, (column) => Number(finish[(row * 64 + column) * 4])),
        0,
        (sum, value) => sum + value
      ) / 64;
    const board = 64 / BOARDS;

    for (const index of Arr.makeBy(BOARDS, (each) => each)) {
      expect(open(index * board)).toBeLessThan(
        open(index * board + board / 2) - 20
      );
    }
  });

  it("saws every board of the planks from its own stretch of the tree", () => {
    const { tone } = paintDetail("planks", 64);
    const board = 64 / BOARDS;
    const middles = Arr.makeBy(BOARDS, (index) =>
      Arr.join(
        Arr.makeBy(64, (column) =>
          String(tone[((index + 0.5) * board * 64 + column) * 4])
        ),
        ","
      )
    );

    expect(Arr.dedupe(middles)).toHaveLength(BOARDS);
  });
});
