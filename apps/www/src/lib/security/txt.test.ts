import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { renderSecurityTxt } from "@/lib/security/txt";

describe("lib/security/txt", () => {
  it("names the contact and expires under a year after the build", () => {
    const text = renderSecurityTxt(
      DateTime.makeUnsafe("2026-10-31T12:00:00.000Z")
    );

    expect(text).toContain("Contact: mailto:nakafaai@gmail.com\n");
    expect(text).toContain("Expires: 2027-10-26T12:00:00.000Z\n");
    expect(text).toContain(
      "Canonical: https://nakafa.com/.well-known/security.txt\n"
    );
  });
});
