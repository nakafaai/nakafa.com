import type { Ref } from "@confect/core";
import type classes from "@repo/backend/confect/_generated/refs/classes";
import type { MaterialGroup } from "@/components/school/classes/materials/types";

type UpdateArgs = Ref.Args<
  typeof classes.materials.mutations.updateMaterialGroup
>;
type UpdatePatch = Omit<UpdateArgs, "groupId">;
type MaterialGroupState = Pick<
  MaterialGroup,
  "description" | "name" | "scheduledAt" | "status" | "updatedAt"
>;

/** Apply editable material-group fields exactly as the mutation resolves them. */
export function updateMaterialGroupState<T extends MaterialGroupState>(
  group: T,
  args: UpdatePatch,
  now: number
) {
  const status = args.status ?? group.status;
  const scheduledAt =
    status === "scheduled"
      ? (args.scheduledAt ?? group.scheduledAt)
      : undefined;

  const { scheduledAt: _scheduledAt, ...fields } = group;
  return {
    ...fields,
    description: args.description ?? group.description,
    name: args.name ?? group.name,
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    status,
    updatedAt: now,
  };
}
