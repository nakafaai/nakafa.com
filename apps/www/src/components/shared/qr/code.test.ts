import { describe, expect, it } from "@effect/vitest";
import { qrSquares } from "@/components/shared/qr/code";

describe("qrSquares", () => {
  it("draws the same text as the same code", () => {
    expect(qrSquares("ABCDE-FGHJK")).toEqual(qrSquares("ABCDE-FGHJK"));
  });

  it("draws another text as another code", () => {
    expect(qrSquares("ABCDE-FGHJK").path).not.toBe(
      qrSquares("KJHGF-EDCBA").path
    );
  });

  it("draws a code of at least version one, 21 modules square", () => {
    const { path, size } = qrSquares("ABCDE-FGHJK");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M")).toBe(true);
  });

  it("grows the code for a longer text, such as the address of a room", () => {
    const short = qrSquares("ABCDE-FGHJK");
    const long = qrSquares(
      "https://harapan.nakafa.com/sittings/w17dbtagrdvymykzfzrhycr4a57t8vya#X26U2H"
    );
    expect(long.size).toBeGreaterThan(short.size);
  });
});
