import { StudentIcon, TeacherIcon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** Role options available in the class invite menu. */
export const inviteRoleList = [
  { value: "teacher", icon: TeacherIcon },
  { value: "student", icon: StudentIcon },
] as const;

export type InviteRole = (typeof inviteRoleList)[number]["value"];

type InviteCode = FunctionReturnType<
  typeof api.classes.queries.getInviteCodes
>[number];

/** Build an invite-code lookup table keyed by class role. */
export function mapInviteCodesByRole(inviteCodes: InviteCode[] | undefined) {
  if (!inviteCodes) {
    return new Map<InviteRole, InviteCode>();
  }

  return new Map(
    inviteCodes.map((inviteCode) => [inviteCode.role, inviteCode] as const)
  );
}
