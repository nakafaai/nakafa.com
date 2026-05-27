import type { Ref } from "@confect/core";
import { StudentIcon, TeacherIcon } from "@hugeicons/core-free-icons";
import type refs from "@repo/backend/confect/_generated/refs";

/** Role options available in the class invite menu. */
export const inviteRoleList = [
  { value: "teacher", icon: TeacherIcon },
  { value: "student", icon: StudentIcon },
] as const;

export type InviteRole = (typeof inviteRoleList)[number]["value"];

type InviteCode = Ref.Returns<
  typeof refs.public.classes.queries.getInviteCodes
>[number];

/** Build an invite-code lookup table keyed by class role. */
export function mapInviteCodesByRole(
  inviteCodes: readonly InviteCode[] | undefined
) {
  if (!inviteCodes) {
    return new Map<InviteRole, InviteCode>();
  }

  return new Map(
    inviteCodes.map((inviteCode) => [inviteCode.role, inviteCode] as const)
  );
}
