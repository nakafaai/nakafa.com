import { describe, expect, it } from "@effect/vitest";
import {
  BOARDS,
  paintDetail,
  SurfaceSchema,
} from "@repo/design-system/components/three/surface/detail";
import {
  TURNS,
  WIRES,
} from "@repo/design-system/components/three/surface/metal";
import { RINGS } from "@repo/design-system/components/three/surface/wood";
import { Array as Arr } from "effect";

/**
 * The first column of a 256 pixel tone tile, top to bottom, and the rows
 * where it first drops clearly below its own mean: the dark lines in it.
 */
function ringsDown(tone: Uint8ClampedArray) {
  const column = Arr.makeBy(256, (row) => Number(tone[row * 256 * 4]));
  const mean = Arr.reduce(column, 0, (sum, value) => sum + value) / 256;
  const lines = Arr.filter(
    Arr.makeBy(256, (row) => row),
    (row) =>
      Number(column[row]) < mean - 12 &&
      Number(column[(row + 255) % 256]) >= mean - 12
  );
  return { column, lines };
}

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

  it("ends every growth ring of sawn wood in a dark line of late wood", () => {
    const { lines } = ringsDown(paintDetail("wood", 256).tone);

    expect(lines.length).toBeGreaterThanOrEqual(RINGS - 3);
    expect(lines.length).toBeLessThanOrEqual(RINGS * 2);
  });

  it("grows no two rings of sawn wood as wide or as dark as each other", () => {
    const { column, lines } = ringsDown(paintDetail("wood", 256).tone);
    const widths = Arr.map(
      lines,
      (row, index) =>
        (Number(lines[(index + 1) % lines.length]) - row + 256) % 256
    );
    const depths = Arr.map(lines, (row) =>
      Math.min(Number(column[row]), Number(column[(row + 1) % 256]))
    );

    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(8);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(8);
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

  it("turns metal in cusps that run around the part, never along it", () => {
    const { normal } = paintDetail("machined", 256);
    const lean = (channel: number) =>
      Arr.reduce(
        Arr.makeBy(256 * 256, (pixel) =>
          Math.abs(Number(normal[pixel * 4 + channel]) - 127.5)
        ),
        0,
        (sum, value) => sum + value
      ) /
      (256 * 256);

    expect(lean(1)).toBeGreaterThan(lean(0) * 4);
    expect(256 / TURNS).toBeGreaterThanOrEqual(4);
  });

  it("polishes metal smoother than a lathe leaves it, and a lathe smoother than a sand mould", () => {
    const rough = (surface: "cast" | "machined" | "polished") => {
      const { finish } = paintDetail(surface, 32);
      return (
        Arr.reduce(
          Arr.makeBy(32 * 32, (pixel) => Number(finish[pixel * 4 + 1])),
          0,
          (sum, value) => sum + value
        ) /
        (32 * 32)
      );
    };

    expect(rough("polished")).toBeLessThan(rough("machined") - 15);
    expect(rough("machined")).toBeLessThan(rough("cast") - 60);
  });

  it("crosses polished metal with hairlines too few to dull it", () => {
    const { tone } = paintDetail("polished", 128);
    const scratched = Arr.filter(
      Arr.makeBy(128 * 128, (pixel) => Number(tone[pixel * 4])),
      (shade) => shade < 244
    );

    expect(scratched.length).toBeGreaterThan(0);
    expect(scratched.length).toBeLessThan(128 * 128 * 0.2);
  });

  it("lays a winding as round wires with a shaded seam where two turns touch", () => {
    const { finish } = paintDetail("winding", 256);
    const open = (row: number) =>
      Arr.reduce(
        Arr.makeBy(256, (column) => Number(finish[(row * 256 + column) * 4])),
        0,
        (sum, value) => sum + value
      ) / 256;
    const turn = 256 / WIRES;

    for (const index of Arr.makeBy(WIRES, (each) => each)) {
      expect(open(index * turn)).toBeLessThan(
        open(index * turn + turn / 2) - 20
      );
    }
  });

  it("mats felt in fibres that lie every way, where cloth keeps to its weave", () => {
    const { normal } = paintDetail("felt", 128);
    const lean = (channel: number) =>
      Arr.reduce(
        Arr.makeBy(128 * 128, (pixel) =>
          Math.abs(Number(normal[pixel * 4 + channel]) - 127.5)
        ),
        0,
        (sum, value) => sum + value
      ) /
      (128 * 128);

    expect(lean(0) / lean(1)).toBeGreaterThan(0.7);
    expect(lean(0) / lean(1)).toBeLessThan(1.4);
  });

  it("keeps paper, cork and foam matt, and anodised aluminium satin between them and bare metal", () => {
    const rough = (
      surface: "anodised" | "brushed" | "cork" | "foam" | "paper"
    ) => {
      const { finish } = paintDetail(surface, 32);
      return (
        Arr.reduce(
          Arr.makeBy(32 * 32, (pixel) => Number(finish[pixel * 4 + 1])),
          0,
          (sum, value) => sum + value
        ) /
        (32 * 32)
      );
    };

    expect(rough("anodised")).toBeGreaterThan(rough("brushed") + 20);
    for (const matt of ["cork", "foam", "paper"] as const) {
      expect(rough(matt)).toBeGreaterThan(rough("anodised") + 80);
    }
  });

  it("pits cork between its granules and creases foam between its beads", () => {
    const darkest = (surface: "cork" | "foam" | "paper") => {
      const { finish } = paintDetail(surface, 64);
      return Math.min(
        ...Arr.makeBy(64 * 64, (pixel) => Number(finish[pixel * 4]))
      );
    };

    expect(darkest("cork")).toBeLessThan(darkest("paper") - 30);
    expect(darkest("foam")).toBeLessThan(darkest("paper") - 30);
  });
});
