import { describe, expect, it } from "@effect/vitest";
import { cardQr, cardQrPayload } from "@/components/tenant/settings/qr";

const card = {
  code: "ABCDE-FGHJK",
  expiresAt: 1_760_000_000_000,
  loginName: "guru.baru",
  name: "Guru Baru",
};

describe("settings card QR", () => {
  it("holds the formatted code and nothing else of the card", () => {
    expect(cardQrPayload(card)).toBe("ABCDE-FGHJK");
    expect(cardQr(card)).toEqual(cardQr({ code: "ABCDE-FGHJK" }));
  });

  it("draws another code as another QR code", () => {
    expect(cardQr({ code: "ABCDE-FGHJK" }).path).not.toBe(
      cardQr({ code: "KJHGF-EDCBA" }).path
    );
  });

  it("draws a QR code of at least version one, 21 modules square", () => {
    const { path, size } = cardQr(card);
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M")).toBe(true);
  });
});
