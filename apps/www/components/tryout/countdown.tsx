import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { cn } from "@repo/design-system/lib/utils";
import { type ComponentProps, Fragment } from "react";

export interface TryoutCountdownSegment {
  label: string;
  value: number;
}

export function TryoutCountdown({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-5 sm:py-5",
        className
      )}
      {...props}
    />
  );
}

export function TryoutCountdownTime({
  segments,
}: {
  segments: readonly TryoutCountdownSegment[];
}) {
  return (
    <NumberFormatGroup>
      <table
        className="mx-auto border-separate border-spacing-x-2 border-spacing-y-0 sm:border-spacing-x-3"
        role="presentation"
      >
        <tbody>
          <tr>
            {segments.map((segment, index) => (
              <Fragment key={`${segment.label}-label`}>
                <td className="text-center align-bottom">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    {segment.label}
                  </span>
                </td>
                {index < segments.length - 1 ? <td /> : null}
              </Fragment>
            ))}
          </tr>
          <tr>
            {segments.map((segment, index) => (
              <Fragment key={segment.label}>
                <td className="text-center align-middle">
                  <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
                    <NumberFormat
                      digits={index === 0 ? undefined : { 1: { max: 5 } }}
                      format={{ minimumIntegerDigits: 2 }}
                      trend={-1}
                      value={segment.value}
                    />
                  </div>
                </td>
                {index < segments.length - 1 ? (
                  <td className="text-center align-middle font-light font-mono text-3xl text-muted-foreground leading-none">
                    :
                  </td>
                ) : null}
              </Fragment>
            ))}
          </tr>
        </tbody>
      </table>
    </NumberFormatGroup>
  );
}

export function TryoutCountdownMeta({
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

export function TryoutCountdownAction({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("flex justify-center pt-4", className)} {...props} />
  );
}
