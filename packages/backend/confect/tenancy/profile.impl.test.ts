import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createTenancyFixture, slugOf } from "@repo/backend/test/tenancy";

describe("tenancy/profile", () => {
  it("shows a school's public identity to anyone, signed in or not", async () => {
    const fixture = await createTenancyFixture();
    const expected = {
      kind: "school",
      name: "Sekolah Lain",
      slug: "other",
      status: "active",
    };
    await expect(
      fixture.t.query(api.tenancy.profile.get, { slug: slugOf("other") })
    ).resolves.toEqual(expected);
    await expect(
      fixture
        .as("owner")
        .query(api.tenancy.profile.get, { slug: slugOf("other") })
    ).resolves.toEqual(expected);
  });

  it("fails with a typed not-found for an unknown address", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.t.query(api.tenancy.profile.get, { slug: slugOf("missing") })
    ).rejects.toMatchObject({
      data: { _tag: "TenantNotFound", code: "TENANT_NOT_FOUND" },
    });
  });
});
