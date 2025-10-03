import NumberFlow from "@number-flow/react";

export function NumberFormat({
  ...props
}: React.ComponentProps<typeof NumberFlow>) {
  return <NumberFlow {...props} />;
}
