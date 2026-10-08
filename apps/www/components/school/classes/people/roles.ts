import type { Ref } from "@confect/core";
import { StudentIcon, TeacherIcon } from "@hugeicons/core-free-icons";
import type classes from "@repo/backend/confect/_generated/refs/classes";
import { HashMap } from "effect";

/** Role options available in the class invite menu. */
export const inviteRoleList = [
  { value: "teacher", icon: TeacherIcon },
  { value: "student", icon: StudentIcon },
] as const;

export type InviteRole = (typeof inviteRoleList)[number]["value"];

type InviteCode = Ref.Returns<typeof classes.queries.getInviteCodes>[number];

/** Build an invite-code lookup table keyed by class role. */
export function mapInviteCodesByRole(
  inviteCodes: readonly InviteCode[] | undefined
) {
  if (!inviteCodes) {
    return HashMap.empty<InviteRole, InviteCode>();
  }

  return HashMap.fromIterable(
    inviteCodes.map((inviteCode) => [inviteCode.role, inviteCode] as const)
  );
}
