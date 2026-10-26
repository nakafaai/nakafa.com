import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

/**
 * Makes an account a member of a new school: a claimed, active member Person of the
 * account, the way an accepted invite leaves it. It returns the Person, so a test can
 * suspend or remove the membership.
 */
export async function seedSchoolMember(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number
) {
  const tenantId = await ctx.db.insert("tenants", {
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: "Sekolah Harapan",
    policies: { emailDomains: [], nina: false, studentThreads: false },
    slug: "harapan",
    status: "active",
  });
  return await ctx.db.insert("tenantPeople", {
    account: { claimedAt: now, method: "invite", state: "claimed", userId },
    kind: "member",
    name: "Siswa Harapan",
    status: "active",
    tenantId,
  });
}
