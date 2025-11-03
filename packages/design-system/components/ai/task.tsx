"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { cn } from "@repo/design-system/lib/utils";
import { BlocksIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type TaskItemFileProps = ComponentProps<"div">;

export const TaskItemFile = ({
  children,
  className,
  ...props
}: TaskItemFileProps) => (
  <div
    className={cn(
      "inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-foreground text-xs",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type TaskItemProps = ComponentProps<"div">;

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div className={cn("text-muted-foreground text-sm", className)} {...props}>
    {children}
  </div>
);

export type TaskProps = ComponentProps<typeof Collapsible>;

export const Task = ({
  defaultOpen = true,
  className,
  ...props
}: TaskProps) => (
  <Collapsible
    className={cn(
      "data-[open=false]:fade-out-0 data-[open=false]:slide-out-to-top-2 data-open:slide-in-from-top-2 data-[open=false]:animate-out data-open:animate-in",
      className
    )}
    defaultOpen={defaultOpen}
    {...props}
  />
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
  icon?: ReactNode;
};

export const TaskTrigger = ({
  children,
  className,
  title,
  icon,
  ...props
}: TaskTriggerProps) => (
  <CollapsibleTrigger
    className={cn("group", className)}
    {...props}
    render={
      children
        ? (triggerProps) => <div {...triggerProps}>{children}</div>
        : (triggerProps) => (
            <div
              {...triggerProps}
              className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground [&_svg]:shrink-0"
            >
              {icon ?? <BlocksIcon className="size-4" />}
              <p className="line-clamp-1 text-sm" title={title}>
                {title}
              </p>
              <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" />
            </div>
          )
    }
  />
);

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
  children,
  className,
  ...props
}: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[open=false]:fade-out-0 data-[open=false]:slide-out-to-top-2 data-open:slide-in-from-top-2 text-popover-foreground outline-none data-[open=false]:animate-out data-open:animate-in",
      className
    )}
    {...props}
  >
    <div className="mt-4 space-y-2 border-muted border-l-2 pl-4">
      {children}
    </div>
  </CollapsibleContent>
);
