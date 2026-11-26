import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  collectCurvePolylines,
  resolveAutoCurveLabels,
} from "@/lib/content/renderer/client/base/visual/autolabel";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveVisualReach } from "@/lib/content/renderer/client/base/visual/reach";
import { resolveVisualProjection } from "@/lib/content/renderer/client/base/visual/transform";
import { plane, space } from "@/test/scene";

const fields = { appearance: "primary" } as const;

describe("resolveAutoCurveLabels", () => {
  it("synthesizes separated equation labels only for unlabeled plane curves and lines", () => {
    const scene = {
      ...plane(
        {
          ...fields,
          id: "labeledLine",
          kind: "line",
          through: [
            { x: -3, y: -3 },
            { x: 3, y: 3 },
          ],
        },
        {
          appearance: "secondary" as const,
          id: "unlabeledLine",
          kind: "line",
          through: [
            { x: -3, y: 3 },
            { x: 3, y: -3 },
          ],
        },
        {
          appearance: "answer" as const,
          id: "verticalLine",
          kind: "line",
          through: [
            { x: 2, y: -3 },
            { x: 2, y: 3 },
          ],
        },
        {
          appearance: "highlight" as const,
          id: "horizontalLine",
          kind: "line",
          through: [
            { x: -3, y: 2 },
            { x: 3, y: 2 },
          ],
        }
      ),
      labels: [
        {
          at: { x: 1, y: 1 },
          key: "l1",
          objectId: "labeledLine",
          placement: "above" as const,
        },
      ],
    };
    const projection = resolveVisualProjection(scene);
    const geometry = resolveVisualGeometry(scene, projection);
    const world = resolveVisualReach(scene, projection);
    const polylines = collectCurvePolylines(geometry.paths, [
      {
        appearance: "primary",
        dashed: false,
        id: "labeledLine:part:1",
        kind: "curve",
        points: [
          { x: -1, y: -1, z: 0 },
          { x: 1, y: 1, z: 0 },
        ],
        unbounded: false,
      },
      {
        appearance: "primary",
        id: "markerOnly",
        kind: "marker",
        point: { x: 0, y: 0, z: 0 },
      },
    ]);

    const auto = resolveAutoCurveLabels(
      scene,
      polylines,
      [{ x: 1, y: 1, z: 0 }],
      world.focus,
      world.origin
    );
    expect(Arr.map(auto, (item) => [item.key, item.latex])).toStrictEqual([
      ["auto:unlabeledLine", "y = -x"],
      ["auto:verticalLine", "x = 2"],
      ["auto:horizontalLine", "y = 2"],
    ]);
    expect(
      Arr.every(
        auto,
        ({ at }) =>
          at.x >= world.focus.x.min &&
          at.x <= world.focus.x.max &&
          at.y >= world.focus.y.min &&
          at.y <= world.focus.y.max
      )
    ).toBe(true);
  });

  it("handles space scenes, edge clipping, overlapping boxes, and non-curve objects safely", () => {
    const spaceScene = space({
      ...fields,
      at: { x: 0, y: 0, z: 0 },
      id: "o",
      kind: "point",
    });
    const spaceProjection = resolveVisualProjection(spaceScene);
    const spaceWorld = resolveVisualReach(spaceScene, spaceProjection);
    expect(
      resolveAutoCurveLabels(
        spaceScene,
        [],
        [],
        spaceWorld.focus,
        spaceWorld.origin
      )
    ).toStrictEqual([]);

    const planeScene = plane(
      { ...fields, at: { x: 0, y: 0 }, id: "pt", kind: "point" },
      { ...fields, formula: "x", id: "missing", kind: "function" },
      { ...fields, formula: "x + 1", id: "outside", kind: "function" },
      { ...fields, formula: "x + 3", id: "parallelOutside", kind: "function" },
      { ...fields, formula: "x + 4", id: "missDiag", kind: "function" },
      { ...fields, formula: "x - 1", id: "onePoint", kind: "function" },
      { ...fields, formula: "x + 2", id: "dense", kind: "function" },
      { ...fields, formula: "x + 5", id: "crowded", kind: "function" },
      { ...fields, formula: "x + 6", id: "degenerate", kind: "function" }
    );
    const projection = resolveVisualProjection(planeScene);
    const world = resolveVisualReach(planeScene, projection);
    const padX = (world.focus.x.max - world.focus.x.min) * 0.14;
    const padY = (world.focus.y.max - world.focus.y.min) * 0.14;
    const cornerX = world.focus.x.min + padX;
    const cornerY = world.focus.y.min + padY;
    const densePoints = Arr.makeBy(30, (i) => ({
      x: world.focus.x.min + ((world.focus.x.max - world.focus.x.min) * i) / 29,
      y: world.focus.y.min + ((world.focus.y.max - world.focus.y.min) * i) / 29,
      z: 0,
    }));

    const auto = resolveAutoCurveLabels(
      planeScene,
      [
        { id: "missing", points: [{ x: cornerX, y: cornerY, z: 0 }] },
        {
          id: "outside",
          points: [
            { x: world.focus.x.max + 10, y: world.focus.y.max + 10, z: 0 },
            { x: world.focus.x.max + 12, y: world.focus.y.max + 12, z: 0 },
          ],
        },
        {
          id: "parallelOutside",
          points: [
            { x: world.focus.x.max + 5, y: -10, z: 0 },
            { x: world.focus.x.max + 5, y: 10, z: 0 },
          ],
        },
        {
          id: "missDiag",
          points: [
            { x: world.focus.x.min - 10, y: world.focus.y.max + 10, z: 0 },
            { x: world.focus.x.min - 8, y: world.focus.y.max + 12, z: 0 },
          ],
        },
        {
          id: "onePoint",
          points: [
            { x: cornerX - 1, y: cornerY + 1, z: 0 },
            { x: cornerX + 1, y: cornerY - 1, z: 0 },
          ],
        },
        { id: "dense", points: densePoints },
        { id: "crowded", points: densePoints },
        {
          id: "degenerate",
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
        },
      ],
      [],
      world.focus,
      world.origin
    );
    expect(Arr.map(auto, (item) => item.key)).toStrictEqual([
      "auto:onePoint",
      "auto:dense",
      "auto:crowded",
      "auto:degenerate",
    ]);

    const soloScene = plane({
      ...fields,
      formula: "2*x + 1",
      id: "solo",
      kind: "function",
    });
    const soloProjection = resolveVisualProjection(soloScene);
    const soloWorld = resolveVisualReach(soloScene, soloProjection);
    const soloLabels = resolveAutoCurveLabels(
      soloScene,
      [
        {
          id: "solo",
          points: [
            { x: -3, y: -5, z: 0 },
            { x: 3, y: 7, z: 0 },
          ],
        },
      ],
      [],
      soloWorld.focus,
      soloWorld.origin
    );
    expect(Arr.map(soloLabels, (item) => item.latex)).toStrictEqual([
      "y = 2 x + 1",
    ]);
  });
});
