"use client";

import { captureException } from "@repo/analytics/posthog";
import {
  type ErrorBoundaryProps,
  ErrorBoundary as ReactErrorBoundary,
} from "react-error-boundary";

export function ErrorBoundary({ onError, ...props }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      {...props}
      onError={(error, info) => {
        captureException(error, {
          component_stack: info.componentStack,
          source: "react-error-boundary",
        });
        onError?.(error, info);
      }}
    />
  );
}
