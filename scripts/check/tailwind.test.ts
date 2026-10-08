import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { inspectTailwindSource } from "#scripts/check/tailwind";

/** Returns the replacement messages for one class string on line one. */
function inspect(classes: string) {
  return inspectTailwindSource("view.tsx", `const view = "${classes}";\n`);
}

describe("Tailwind built-in class policy", () => {
  it("names the spacing step for px, rem, zero and a single pixel", () => {
    expect(
      inspect("size-[4px] min-h-[28rem] gap-[18px] p-[0] mt-[0px] h-[1px]")
    ).toEqual([
      "view.tsx:1: use size-1 instead of size-[4px].",
      "view.tsx:1: use min-h-112 instead of min-h-[28rem].",
      "view.tsx:1: use gap-4.5 instead of gap-[18px].",
      "view.tsx:1: use p-0 instead of p-[0].",
      "view.tsx:1: use mt-0 instead of mt-[0px].",
      "view.tsx:1: use h-px instead of h-[1px].",
    ]);
  });

  it("names fractions and viewport units for sizes and positions", () => {
    expect(
      inspect(
        "max-w-[80%] top-[12.5%] w-[100%] basis-[0%] h-[100dvh] min-w-[100vw]"
      )
    ).toEqual([
      "view.tsx:1: use max-w-4/5 instead of max-w-[80%].",
      "view.tsx:1: use top-1/8 instead of top-[12.5%].",
      "view.tsx:1: use w-full instead of w-[100%].",
      "view.tsx:1: use basis-0 instead of basis-[0%].",
      "view.tsx:1: use h-dvh instead of h-[100dvh].",
      "view.tsx:1: use min-w-screen instead of min-w-[100vw].",
    ]);
  });

  it("keeps the sign of negative values on utilities that take one", () => {
    expect(
      inspect(
        "hover:-mt-[2px] translate-x-[-50%] -mt-[-2px] z-[-1] -scale-x-[1]"
      )
    ).toEqual([
      "view.tsx:1: use -mt-0.5 instead of -mt-[2px].",
      "view.tsx:1: use -translate-x-1/2 instead of translate-x-[-50%].",
      "view.tsx:1: use mt-0.5 instead of -mt-[-2px].",
      "view.tsx:1: use -z-1 instead of z-[-1].",
      "view.tsx:1: use -scale-x-100 instead of -scale-x-[1].",
    ]);
  });

  it("names line widths, keeping bare hairlines for borders and dividers", () => {
    expect(
      inspect(
        "ring-[3px] ring-[1px] border-[1px] border-t-[2px] divide-x-[1px] outline-[0]"
      )
    ).toEqual([
      "view.tsx:1: use ring-3 instead of ring-[3px].",
      "view.tsx:1: use ring-1 instead of ring-[1px].",
      "view.tsx:1: use border instead of border-[1px].",
      "view.tsx:1: use border-t-2 instead of border-t-[2px].",
      "view.tsx:1: use divide-x instead of divide-x-[1px].",
      "view.tsx:1: use outline-0 instead of outline-[0].",
    ]);
  });

  it("names whole-number steps, including flex and grid placement", () => {
    expect(
      inspect(
        "z-[60] grow-[0] shrink-[0] flex-[2] columns-[3] col-span-[2] row-start-[-1]"
      )
    ).toEqual([
      "view.tsx:1: use z-60 instead of z-[60].",
      "view.tsx:1: use grow-0 instead of grow-[0].",
      "view.tsx:1: use shrink-0 instead of shrink-[0].",
      "view.tsx:1: use flex-2 instead of flex-[2].",
      "view.tsx:1: use columns-3 instead of columns-[3].",
      "view.tsx:1: use col-span-2 instead of col-span-[2].",
      "view.tsx:1: use -row-start-1 instead of row-start-[-1].",
    ]);
  });

  it("names percentage, time, rotation, ratio and grid track steps", () => {
    expect(
      inspect(
        "opacity-[.35] scale-[102%] duration-[450ms] delay-[0.2s] rotate-[45deg] aspect-[40/21] aspect-[1/1] aspect-[16/9] grid-cols-[repeat(3,minmax(0,1fr))]"
      )
    ).toEqual([
      "view.tsx:1: use opacity-35 instead of opacity-[.35].",
      "view.tsx:1: use scale-102 instead of scale-[102%].",
      "view.tsx:1: use duration-450 instead of duration-[450ms].",
      "view.tsx:1: use delay-200 instead of delay-[0.2s].",
      "view.tsx:1: use rotate-45 instead of rotate-[45deg].",
      "view.tsx:1: use aspect-40/21 instead of aspect-[40/21].",
      "view.tsx:1: use aspect-square instead of aspect-[1/1].",
      "view.tsx:1: use aspect-video instead of aspect-[16/9].",
      "view.tsx:1: use grid-cols-3 instead of grid-cols-[repeat(3,minmax(0,1fr))].",
    ]);
  });

  it("accepts values that no built-in class renders", () => {
    expect(
      inspect(
        Arr.join(
          [
            "w-[calc(100%-2rem)] p-[1.5px] w-[33%] m-[50%] h-[50vh] size-[auto]",
            "w-[-2px] text-[8px] rounded-[3px] border-[#fff] ring-[1.5px]",
            "z-[auto] flex-[1_1_0%] opacity-[0.333] opacity-[half] scale-[1.005%] duration-[fast]",
            "delay-[0.0005s] rotate-[0.5turn] aspect-[1.45] grid-cols-[1fr_auto]",
            "data-[state=open]:bg-accent group-data-[collapsible=icon]/item:w-4",
          ],
          " "
        )
      )
    ).toEqual([]);
  });

  it("reports the line of each value and skips test modules", () => {
    const source = 'const a = "p-4";\nconst b = "size-[8px]";\n';

    expect(inspectTailwindSource("view.tsx", source)).toEqual([
      "view.tsx:2: use size-2 instead of size-[8px].",
    ]);
    expect(inspectTailwindSource("view.test.ts", source)).toEqual([]);
    expect(inspectTailwindSource("view.test.tsx", source)).toEqual([]);
  });
});
