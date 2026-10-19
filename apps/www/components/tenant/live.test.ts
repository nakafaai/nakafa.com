import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";
import type { TenantValue } from "@/components/tenant/context";
import { liveTenant } from "@/components/tenant/live";

const rendered: TenantValue = {
  canManage: true,
  canOpenExams: true,
  greeting: { firstName: "Sari", part: "morning" },
  home: { canCreate: false, canWatch: false, choices: [], languages: [] },
  logo: "https://files.example.com/rendered.png",
  mascot: Schema.decodeSync(MascotCode)("cat.0.243e66.right.open"),
  name: "Yayasan Lama",
  role: "owner",
  slug: Schema.decodeSync(TenantSlug)("harapan"),
};

describe("components/tenant/live liveTenant", () => {
  it("shows the layout's name and logo until the viewer's query answers", () => {
    expect(liveTenant(rendered, undefined)).toBe(rendered);
  });

  it("shows the live name and logo once the viewer's query answers", () => {
    expect(
      liveTenant(rendered, {
        logo: "https://files.example.com/live.png",
        name: "Yayasan Harapan",
      })
    ).toEqual({
      ...rendered,
      logo: "https://files.example.com/live.png",
      name: "Yayasan Harapan",
    });
  });

  it("drops the logo when the live school has none, so a removed logo leaves the mark at once", () => {
    const shown = liveTenant(rendered, { name: "Yayasan Lama" });
    expect(shown.logo).toBeUndefined();
    expect(shown).toMatchObject({
      mascot: rendered.mascot,
      name: "Yayasan Lama",
    });
  });
});
