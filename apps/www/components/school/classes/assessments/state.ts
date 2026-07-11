import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";

type UpdateArgs = FunctionArgs<
  typeof api.assessments.mutations.public.update.updateAssessment
>;
type UpdatePatch = Omit<UpdateArgs, "assessmentId" | "schoolId">;
interface AssessmentState {
  description?: UpdateArgs["description"];
  mode: NonNullable<UpdateArgs["mode"]>;
  scheduledAt?: number;
  status: NonNullable<UpdateArgs["status"]>;
  title: string;
  updatedAt: number;
}

/** Apply editable assessment fields exactly as the mutation resolves them. */
export function updateAssessmentState<T extends AssessmentState>(
  assessment: T,
  args: UpdatePatch,
  now: number
): T {
  const status = args.status ?? assessment.status;
  const scheduledAt =
    status === "scheduled"
      ? (args.scheduledAt ?? assessment.scheduledAt)
      : undefined;

  return {
    ...assessment,
    description: args.description ?? assessment.description,
    mode: args.mode ?? assessment.mode,
    scheduledAt,
    status,
    title: args.title ?? assessment.title,
    updatedAt: now,
  };
}
