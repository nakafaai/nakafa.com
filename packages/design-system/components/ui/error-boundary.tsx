import { captureException } from "@repo/analytics/posthog/capture";
import {
  type ErrorBoundaryProps,
  ErrorBoundary as ReactErrorBoundary,
} from "react-error-boundary";

export function ErrorBoundary({
  onError,
  report = true,
  ...props
}: ErrorBoundaryProps & {
  /** `false` leaves the report to another boundary of the same failure, or to the caller. */
  report?: boolean;
}) {
  return (
    <ReactErrorBoundary
      {...props}
      onError={(error, info) => {
        if (report) {
          captureException(error, {
            component_stack: info.componentStack,
            source: "react-error-boundary",
          });
        }
        onError?.(error, info);
      }}
    />
  );
}
