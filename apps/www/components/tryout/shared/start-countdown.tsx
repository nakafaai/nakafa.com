import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cn } from "@repo/design-system/lib/utils";
import { type ComponentProps, Fragment } from "react";

export interface TryoutStartCountdownSegment {
  label: string;
  value: number;
}

export function TryoutStartCountdown({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border bg-card p-5 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function TryoutStartCountdownTime({
  segments,
}: {
  segments: readonly TryoutStartCountdownSegment[];
}) {
  return (
    <NumberFormatGroup>
      <div className="flex items-end justify-center gap-2 sm:gap-3">
        {segments.map((segment, index) => (
          <Fragment key={segment.label}>
            <div className="grid gap-1 text-center">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {segment.label}
              </span>
              <span className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
                <NumberFormat
                  aria-label={segment.label}
                  digits={index === 0 ? undefined : { 1: { max: 5 } }}
                  format={{ minimumIntegerDigits: 2 }}
                  trend={-1}
                  value={segment.value}
                />
              </span>
            </div>
            {index < segments.length - 1 ? (
              <span className="pb-0.5 text-center align-middle font-light font-mono text-3xl text-muted-foreground leading-none">
                :
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </NumberFormatGroup>
  );
}

export function TryoutStartCountdownMeta({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-center text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export function TryoutStartCountdownAction({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("flex justify-center pt-4", className)} {...props} />
  );
}
