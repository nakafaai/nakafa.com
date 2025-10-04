"use client";

import {
  type ErrorBoundaryProps,
  ErrorBoundary as ReactErrorBoundary,
} from "react-error-boundary";

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ReactErrorBoundary {...props} />;
}
