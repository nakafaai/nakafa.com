import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

type Icon = ComponentProps<typeof HugeIcons>["icon"];

/**
 * One step of an activity's evidence: its icon and label, and its details
 * under the label. Every part of the evidence draws its steps with this, so a
 * label has the size of the activity row above it (`text-sm`, a 16 px icon in
 * the middle of its first line), and the details start where the label's text
 * starts, which is what makes them read as the step's own. A step names its
 * own icon, never the icon of the activity it belongs to.
 */
export function Step({
  children,
  failed = false,
  icon,
  label,
}: {
  children?: ReactNode;
  failed?: boolean;
  icon: Icon;
  label: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p
        className={cn(
          "flex min-w-0 items-start gap-2 text-sm",
          failed ? "text-destructive" : "text-muted-foreground"
        )}
        data-slot="evidence-step"
      >
        <StepLabel icon={icon}>{label}</StepLabel>
      </p>
      {children ? <StepDetails>{children}</StepDetails> : null}
    </div>
  );
}

/**
 * The icon and the words of a step, inside a row that sets their colour: the
 * header of a `Step`, or the trigger of a step that opens.
 */
export function StepLabel({
  children,
  icon,
}: {
  children: ReactNode;
  icon: Icon;
}) {
  return (
    <>
      <HugeIcons className="mt-0.5 size-4 shrink-0" icon={icon} />
      <span className="min-w-0">{children}</span>
    </>
  );
}

/** The details of a step, from where the words of its label start. */
export function StepDetails({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2 ps-6">{children}</div>;
}
