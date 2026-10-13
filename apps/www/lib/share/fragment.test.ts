import { describe, expect, it } from "@effect/vitest";
import { withoutShareToken } from "@/lib/share/fragment";

/** 43 URL-safe characters, the shape of a share token. */
const token = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";

describe("share token in a fragment", () => {
  it("leaves a fragment that carries no token exactly as it is", () => {
    for (const hash of ["", "#", "#comments", "#a=1&b=two%20words", "#a+b"]) {
      expect(withoutShareToken(hash)).toBe(hash);
    }
  });

  it("empties a fragment that holds only the token", () => {
    expect(withoutShareToken(`#share=${token}`)).toBe("");
    expect(withoutShareToken("#share=short")).toBe("");
  });

  it("keeps the other entries of a fragment that holds the token too", () => {
    expect(withoutShareToken(`#a=1&share=${token}&b=2`)).toBe("#a=1&b=2");
    expect(withoutShareToken(`#share=${token}&share=${token}&c=3`)).toBe(
      "#c=3"
    );
  });

  it("finds the entry under its encoded name, as the reader of a link does", () => {
    expect(withoutShareToken(`#sh%61re=${token}`)).toBe("");
  });
});
