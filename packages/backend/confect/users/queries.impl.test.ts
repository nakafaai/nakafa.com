import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { seedSchoolMember } from "@repo/backend/test/member";

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const getProfileByUsername = Ref.getFunctionReference(
  refs.public.users.queries.getProfileByUsername
);

/** Reads the profile of a username as one caller. */
const profileOf = (
  caller: Pick<ReturnType<typeof createConvexTestWithAuth>, "query">,
  username: string
) => caller.query(getProfileByUsername, { username });

/** The caller signed in as one seeded account. */
const callerOf = (
  t: ReturnType<typeof createConvexTestWithAuth>,
  account: Awaited<ReturnType<typeof seedAuthenticatedUser>>
) =>
  t.withIdentity({ subject: account.sessionId });

/** A learner who holds the username nabilfatih with a bio and a photo, and another account. */
async function seedProfiles(
  t: ReturnType<typeof createConvexTestWithAuth>
) {
  const holder = await t.mutation(async (ctx) => {
    const seeded = await seedAuthenticatedUser(ctx, {
      now: NOW,
      suffix: "profile-holder",
    });
    await ctx.db.patch("users", seeded.userId, {
      bio: "Belajar aljabar setiap hari.",
      image: "https://photos.example.com/holder.jpg",
      name: "Nabil Fatih",
      picture: "photo",
      username: "nabilfatih",
    });
    return seeded;
  });
  const stranger = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "profile-stranger" })
  );
  return { holder, stranger };
}

describe("users/queries", () => {
  it("refuses a visitor and checks a username for an account and for the account that holds it", async () => {
    const t = createConvexTestWithAuth();
    const holder = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "holder",
      });
      await ctx.db.patch("users", seeded.userId, { username: "nabilfatih" });
      return seeded;
    });
    const stranger = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "stranger" })
    );
    const signedIn = (account: typeof holder) =>
      t.withIdentity({ subject: account.sessionId });
    const check = (caller: Pick<typeof t, "query">, username: string) =>
      caller.query(api.users.queries.checkUsername, { username });

    // A visitor learns nothing, not even whether a name is taken.
    await expect(check(t, "nabilfatih")).rejects.toMatchObject({
      data: { _tag: "SessionRequired", code: "UNAUTHENTICATED" },
    });
    const other = signedIn(stranger);
    expect(await check(other, "Teman_Baru")).toBe("available");
    expect(await check(other, "NabilFatih")).toBe("taken");
    expect(await check(signedIn(holder), "nabilfatih")).toBe("available");
    expect(await check(other, "ab")).toBe("tooShort");
    expect(await check(other, "9lives")).toBe("letterFirst");
    expect(await check(other, "a b")).toBe("characters");
    expect(await check(other, "admin")).toBe("notAllowed");
  });

  it("shows a learner's profile to anyone, to share, and nothing for a name nobody holds", async () => {
    const t = createConvexTestWithAuth();
    const { holder, stranger } = await seedProfiles(t);
    // Only the public fields leave the server: no email, auth id, plan, or settings.
    const expected = {
      _id: holder.userId,
      bio: "Belajar aljabar setiap hari.",
      image: "https://photos.example.com/holder.jpg",
      mascot: MASCOT_CODE,
      name: "Nabil Fatih",
      shareable: true,
      username: "nabilfatih",
    };
    expect(await profileOf(callerOf(t, holder), "nabilfatih")).toStrictEqual(
      expected
    );
    expect(await profileOf(t, "nabilfatih")).toStrictEqual(expected);
    expect(await profileOf(callerOf(t, stranger), "nabilfatih")).toStrictEqual(
      expected
    );
    expect(await profileOf(t, "nobodyholdsthis")).toBeNull();
  });

  it("shows a school member's profile to its own account alone, never to share (K15)", async () => {
    const t = createConvexTestWithAuth();
    const { holder, stranger } = await seedProfiles(t);
    const personId = await t.mutation((ctx) =>
      seedSchoolMember(ctx, holder.userId, NOW)
    );
    const statusOf = (status: "removed" | "suspended") =>
      t.mutation((ctx) => ctx.db.patch("tenantPeople", personId, { status }));

    for (const status of ["active", "suspended"] as const) {
      if (status === "suspended") {
        await statusOf(status);
      }
      expect(await profileOf(callerOf(t, holder), "nabilfatih")).toMatchObject({
        shareable: false,
        username: "nabilfatih",
      });
      // A visitor and another account get the answer of a name nobody holds.
      expect(await profileOf(t, "nabilfatih"), status).toBeNull();
      expect(
        await profileOf(callerOf(t, stranger), "nabilfatih"),
        status
      ).toBeNull();
    }
    // A removed member belongs to no school, so the profile is public again.
    await statusOf("removed");
    expect(await profileOf(t, "nabilfatih")).toMatchObject({
      shareable: true,
    });
  });

  it("hides the photo of an account that shows its animal, and an empty bio", async () => {
    const t = createConvexTestWithAuth();
    const holder = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "animal-holder",
      });
      await ctx.db.patch("users", seeded.userId, {
        image: "https://photos.example.com/hidden.jpg",
        name: "Siti Aminah",
        picture: "animal",
        username: "sitiaminah",
      });
      return seeded;
    });

    expect(
      await t
        .withIdentity({ subject: holder.sessionId })
        .query(getProfileByUsername, {
          username: "sitiaminah",
        })
    ).toStrictEqual({
      _id: holder.userId,
      mascot: MASCOT_CODE,
      name: "Siti Aminah",
      shareable: true,
      username: "sitiaminah",
    });
  });
});
