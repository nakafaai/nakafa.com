import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createTypedName } from "@/components/tenant/start/typed";

describe("school start typed name", () => {
  it("suggests the address from the name until the founder types one", () => {
    const typed = createTypedName(null);
    typed.getState().setName("SMA Harapan");
    expect(typed.getState()).toMatchObject({
      edited: false,
      slug: "sma-harapan",
    });

    typed.getState().setSlug("Harapan Baru");
    typed.getState().setName("SMA Harapan Bangsa");
    expect(typed.getState()).toMatchObject({
      edited: true,
      name: "SMA Harapan Bangsa",
      slug: "harapan-baru",
    });

    typed.getState().setSlug("");
    typed.getState().setName("SMA Nusa");
    expect(typed.getState()).toMatchObject({ edited: false, slug: "sma-nusa" });
  });

  it("starts from the saved draft, and knows an address that was typed", () => {
    const slug = Schema.decodeSync(TenantSlug)("harapan");
    expect(
      createTypedName({ name: "Harapan", slug, updatedAt: 1 }).getState()
    ).toMatchObject({ edited: false, name: "Harapan", slug: "harapan" });
    expect(
      createTypedName({ name: "SMA Harapan", slug, updatedAt: 1 }).getState()
    ).toMatchObject({ edited: true, slug: "harapan" });
  });
});
