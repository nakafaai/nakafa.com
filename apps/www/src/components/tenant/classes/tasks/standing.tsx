import { standingOf } from "@repo/backend/confect/classroom/tasks/schema";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useClassScope } from "@/components/tenant/classes/scope";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";

/** Where a task stands: the viewer's own work for a student of the class, and how many handed work in for anyone else. */
export function TaskStanding({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();
  if (!Arr.contains(can, "task.submit")) {
    return t("task-handed-in-count", { count: task.handedIn });
  }
  if (task.mine !== null && task.mine.score !== null) {
    return t("task-scored", { points: task.points, score: task.mine.score });
  }
  const standing = standingOf(task.mine);
  if (standing === "open") {
    return t("task-not-handed-in");
  }
  return standing === "late" ? t("task-handed-in-late") : t("task-submissions");
}
