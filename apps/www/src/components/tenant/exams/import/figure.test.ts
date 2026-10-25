import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  alignFigures,
  cropFigure,
  pixelsOf,
} from "@/components/tenant/exams/import/figure";

/** A decoded page of 1200 by 1600 pixels, which the crop closes once it is drawn. */
const bitmap = () => ({ close: vi.fn(), height: 1600, width: 1200 });

describe("pixelsOf", () => {
  it("turns a box in thousandths into pixels, its corners in order whichever way Nina gave them", () => {
    expect(
      pixelsOf({ bottom: 500, left: 100, right: 600, top: 250 }, 1200, 1600)
    ).toEqual({ height: 400, width: 600, x: 120, y: 400 });
    expect(
      pixelsOf({ bottom: 250, left: 600, right: 100, top: 500 }, 1200, 1600)
    ).toEqual({ height: 400, width: 600, x: 120, y: 400 });
  });
});

describe("cropFigure", () => {
  it.effect(
    "cuts the box from the page as a PNG file and closes the decoded page",
    () =>
      Effect.gen(function* () {
        const page = bitmap();
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.resolve(page))
        );
        const drawImage = vi.fn();
        const getContext = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          configurable: true,
          value: () => ({ drawImage }),
        });
        const encode = vi
          .spyOn(HTMLCanvasElement.prototype, "toBlob")
          .mockImplementation((done) => done(new Blob(["png"])));
        const file = yield* cropFigure(new Blob(["page"]), {
          bottom: 500,
          left: 100,
          right: 600,
          top: 250,
        });
        expect(file).toMatchObject({ name: "figure.png", type: "image/png" });
        expect(drawImage).toHaveBeenCalledWith(
          page,
          120,
          400,
          600,
          400,
          0,
          0,
          600,
          400
        );
        expect(page.close).toHaveBeenCalledTimes(1);
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          configurable: true,
          value: getContext,
        });
        encode.mockRestore();
        vi.unstubAllGlobals();
      })
  );

  it.effect(
    "refuses a speck, a page that does not decode, and a figure that does not encode",
    () =>
      Effect.gen(function* () {
        const page = bitmap();
        const decode = vi.fn(() => Promise.resolve(page));
        vi.stubGlobal("createImageBitmap", decode);
        const speck = yield* cropFigure(new Blob(), {
          bottom: 5,
          left: 0,
          right: 5,
          top: 0,
        }).pipe(Effect.flip);
        expect(page.close).toHaveBeenCalledTimes(1);
        decode.mockImplementationOnce(() =>
          Promise.reject(new Error("broken"))
        );
        const broken = yield* cropFigure(new Blob(), {
          bottom: 500,
          left: 0,
          right: 500,
          top: 0,
        }).pipe(Effect.flip);
        const encode = vi
          .spyOn(HTMLCanvasElement.prototype, "toBlob")
          .mockImplementation((done) => done(null));
        const unencoded = yield* cropFigure(new Blob(), {
          bottom: 500,
          left: 0,
          right: 500,
          top: 0,
        }).pipe(Effect.flip);
        expect([speck._tag, broken._tag, unencoded._tag]).toEqual([
          "FigureUncut",
          "FigureUncut",
          "FigureUncut",
        ]);
        encode.mockRestore();
        vi.unstubAllGlobals();
      })
  );
});

describe("alignFigures", () => {
  it("drops a figure that was not made with its mark, and counts the later marks down, in the explanation too", () => {
    expect(
      alignFigures(
        {
          explanation: "Lihat lagi\n{{figure:3}}",
          options: ["{{figure:3}}", "Bukan"],
          prompt: "Lihat\n{{figure:1}}\n{{figure:2}}",
        },
        [Option.some("a"), Option.none(), Option.some("c")]
      )
    ).toEqual({
      explanation: "Lihat lagi\n{{figure:2}}",
      figures: ["a", "c"],
      options: ["{{figure:2}}", "Bukan"],
      prompt: "Lihat\n{{figure:1}}\n",
    });
  });
});
