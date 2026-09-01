import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

const NOW = Date.UTC(2026, 7, 22, 5, 0, 0);

const schoolInput = {
  address: "Jl. Merdeka 1",
  city: "Jakarta",
  name: "Select",
  phone: "021-123456",
  province: "DKI Jakarta",
  type: "high-school" as const,
};

describe("schools/mutations", () => {
  it("keeps generated school slugs outside static School routes", async () => {
    const t = createConvexTestWithBetterAuth();
    const user = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reserved-school-slug",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: user.sessionId,
      subject: user.authUserId,
    });

    const first = await authenticated.mutation(
      api.schools.mutations.createSchool,
      {
        ...schoolInput,
        email: "reserved-school-1@example.com",
      }
    );
    const second = await authenticated.mutation(
      api.schools.mutations.createSchool,
      {
        ...schoolInput,
        email: "reserved-school-2@example.com",
      }
    );

    expect(first.slug).toBe("select-1");
    expect(second.slug).toBe("select-2");
  });
});
