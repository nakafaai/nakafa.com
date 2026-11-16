import NumberFlow, { NumberFlowGroup } from "@number-flow/react";

/**
 * A number in the reader's locale that animates from its old value to its new one, for counts and scores that change
 * while the reader watches.
 */
export function NumberFormat({
  ...props
}: React.ComponentProps<typeof NumberFlow>) {
  return <NumberFlow {...props} />;
}

export function NumberFormatGroup({
  ...props
}: React.ComponentProps<typeof NumberFlowGroup>) {
  return <NumberFlowGroup {...props} />;
}
