import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";

type UpdateArgs = FunctionArgs<
  typeof api.classes.materials.mutations.updateMaterialGroup
>;
type UpdatePatch = Omit<UpdateArgs, "groupId">;
interface MaterialGroupState {
  description: string;
  name: string;
  scheduledAt?: number;
  status: NonNullable<UpdateArgs["status"]>;
  updatedAt: number;
}

/** Apply editable material-group fields exactly as the mutation resolves them. */
export function updateMaterialGroupState<T extends MaterialGroupState>(
  group: T,
  args: UpdatePatch,
  now: number
): T {
  const status = args.status ?? group.status;
  const scheduledAt =
    status === "scheduled"
      ? (args.scheduledAt ?? group.scheduledAt)
      : undefined;

  return {
    ...group,
    description: args.description ?? group.description,
    name: args.name ?? group.name,
    scheduledAt,
    status,
    updatedAt: now,
  };
}
