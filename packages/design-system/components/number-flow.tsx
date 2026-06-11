import NumberFlow, { NumberFlowGroup } from "@number-flow/react";

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
