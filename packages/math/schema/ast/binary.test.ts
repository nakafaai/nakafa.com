import { readBinaryConstantValue } from "@repo/math/schema/ast/binary";
import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { describe, expect, it } from "vitest";

describe("binary MathAst constant operations", () => {
  it("rejects pi multiple combinations that lose fractional offsets", () => {
    expect(
      readBinaryConstantValue(
        "add",
        constant(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
        constant(0.5, 0.5)
      ).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue(
        "subtract",
        constant(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
        constant(0.5, 0.5)
      ).tag
    ).toBe("InvalidConstant");
  });

  it("rejects pi quotient drift near exact trig sentinels", () => {
    expect(
      readBinaryConstantValue(
        "divide",
        constant(Math.PI * 1e-308, 1e-308),
        constant(1e-309 * 10)
      ).tag
    ).toBe("InvalidConstant");
  });

  it("rejects pi product drift and preserves identity powers", () => {
    expect(
      readBinaryConstantValue(
        "multiply",
        constant(Math.PI / 3, 1 / 3),
        constant(3)
      ).tag
    ).toBe("InvalidConstant");

    const poweredPi = readBinaryConstantValue(
      "power",
      constant(Math.PI, 1),
      constant(1)
    );

    expect(poweredPi).toEqual({
      tag: "Constant",
      value: { isExactZero: false, piMultiple: 1, value: Math.PI },
    });
  });

  it("preserves pi products that reduce back to one pi", () => {
    const piSquared = readBinaryConstantValue(
      "multiply",
      constant(Math.PI, 1),
      constant(Math.PI, 1)
    );

    expect(piSquared).toEqual({
      tag: "Constant",
      value: {
        isExactZero: false,
        piSquareMultiple: 1,
        value: Math.PI * Math.PI,
      },
    });

    if (piSquared.tag !== "Constant") {
      return;
    }

    expect(
      readBinaryConstantValue("divide", piSquared.value, constant(Math.PI, 1))
    ).toEqual({
      tag: "Constant",
      value: { isExactZero: false, piMultiple: 1, value: Math.PI },
    });
  });

  it("scales pi-squared metadata through numeric products and quotients", () => {
    const piSquared = {
      isExactZero: false,
      piSquareMultiple: 2,
      value: 2 * Math.PI * Math.PI,
    };

    expect(readBinaryConstantValue("multiply", piSquared, constant(3))).toEqual(
      {
        tag: "Constant",
        value: {
          isExactZero: false,
          piSquareMultiple: 6,
          value: 6 * Math.PI * Math.PI,
        },
      }
    );
    expect(readBinaryConstantValue("divide", piSquared, constant(4))).toEqual({
      tag: "Constant",
      value: {
        isExactZero: false,
        piSquareMultiple: 0.5,
        value: (2 * Math.PI * Math.PI) / 4,
      },
    });
  });

  it("rejects unsupported pi power products", () => {
    const piSquared = {
      isExactZero: false,
      piSquareMultiple: 1,
      value: Math.PI * Math.PI,
    };

    expect(
      readBinaryConstantValue("multiply", piSquared, constant(Math.PI, 1)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue(
        "multiply",
        constant(Math.PI / 3, 1 / 3),
        constant(3 * Math.PI, 3)
      ).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue(
        "multiply",
        { isExactZero: false, piSquareMultiple: 1 / 3, value: Math.PI },
        constant(3)
      ).tag
    ).toBe("InvalidConstant");
    expect(readBinaryConstantValue("multiply", piSquared, piSquared).tag).toBe(
      "InvalidConstant"
    );
    expect(
      readBinaryConstantValue("divide", piSquared, {
        isExactZero: false,
        value: 0,
      }).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue(
        "divide",
        { isExactZero: false, piSquareMultiple: 1e-308, value: Math.PI },
        { isExactZero: false, piMultiple: 1e-309 * 10, value: Math.PI }
      ).tag
    ).toBe("InvalidConstant");
  });

  it("uses decimal sums so exact cancellation cannot drift nonzero", () => {
    const sum = readBinaryConstantValue("add", constant(0.1), constant(0.2));

    expect(sum).toEqual({
      tag: "Constant",
      value: { isExactZero: false, value: 0.3 },
    });

    if (sum.tag !== "Constant") {
      return;
    }

    expect(
      readBinaryConstantValue("subtract", sum.value, constant(0.3))
    ).toEqual({
      tag: "Constant",
      value: { isExactZero: true, value: 0 },
    });
  });

  it("rejects rounded and nonfinite plain constant arithmetic", () => {
    expect(
      readBinaryConstantValue("add", constant(1e308), constant(1e308)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue("add", constant(1e20), constant(1)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue("subtract", constant(1e20), constant(1)).tag
    ).toBe("InvalidConstant");
    expect(
      readBinaryConstantValue("divide", constant(1e308), constant(1e-308)).tag
    ).toBe("InvalidConstant");
  });
});

function constant(value: number, piMultiple?: number): ConstantMathAstValue {
  return {
    isExactZero: value === 0,
    piMultiple,
    value,
  };
}
