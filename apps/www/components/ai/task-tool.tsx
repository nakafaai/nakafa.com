import type { CreateTaskOutput } from "@repo/ai/schema/tools";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@repo/design-system/components/ai/task";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: CreateTaskOutput;
};

export const TaskTool = memo(({ status, output }: Props) => {
  const loading = status === "input-streaming" || status === "input-available";

  if (loading) {
    return (
      <Task>
        <TaskTrigger
          icon={<SpinnerIcon className="size-4" />}
          title="Preparing next moves..."
        />
      </Task>
    );
  }

  return output?.tasks.map((task) => (
    <Task key={task.title}>
      <TaskTrigger title={task.title} />
      <TaskContent>
        {task.items.map((item) => (
          <TaskItem key={item.title}>{item.title}</TaskItem>
        ))}
      </TaskContent>
    </Task>
  ));
});
TaskTool.displayName = "TaskTool";
