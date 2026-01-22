"use client";

import { Sad02Icon } from "@hugeicons/core-free-icons";
import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { analytics } from "@repo/analytics/posthog";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  checkWebGL2Support,
  getDeviceInfoForAnalytics,
  getPowerPreference,
} from "@repo/design-system/lib/device";
import { cn } from "@repo/design-system/lib/utils";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  const t = useTranslations("Error");
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
      <div className="space-y-4 text-center">
        <h1 className="font-bold font-mono text-2xl text-primary">5XX</h1>

        <div className="space-y-2">
          <h2 className="font-medium tracking-tight">{t("title")}</h2>

          <p className="mx-auto max-w-md text-muted-foreground text-sm">
            {errorMessage}
          </p>
        </div>

        <div className="mx-auto grid w-fit grid-cols-2 gap-2">
          <Button onClick={resetErrorBoundary} size="sm" variant="secondary">
            {t("retry")}
          </Button>
          <a
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            href="https://github.com/nakafaai/nakafa.com/issues"
            rel="noopener noreferrer"
            target="_blank"
            title={t("report")}
          >
            {t("report")}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * ThreeCanvas component with WebGL capability detection and error tracking
 *
 * Automatically detects WebGL2 support, selects appropriate GPU power preference,
 * and tracks initialization status to PostHog. Uses Canvas fallback for WebGL
 * unsupported devices.
 *
 * @param children - React Three.js children to render
 * @param frameloop - Frame update strategy ("always" | "demand" | "never")
 * @param props - Additional CanvasProps passed to @react-three/fiber Canvas
 *
 * @returns JSX element with WebGL detection and error handling
 */
function ThreeCanvasComponent({
  children,
  frameloop = "demand",
  ...props
}: {
  children: ReactNode;
  frameloop?: "always" | "demand" | "never";
} & CanvasProps) {
  const powerPreference = getPowerPreference();
  const deviceInfo = getDeviceInfoForAnalytics();

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onError={(error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        analytics.capture("webgl_error", {
          error: errorMessage,
          component: "ThreeCanvas",
          supported: checkWebGL2Support(),
          ...deviceInfo,
        });
      }}
    >
      <Canvas
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <HugeIcons
              aria-hidden="true"
              className="size-6 shrink-0"
              icon={Sad02Icon}
            />
          </div>
        }
        frameloop={frameloop}
        gl={{
          antialias: true,
          powerPreference,
          alpha: true,
        }}
        onCreated={() => {
          analytics.capture("webgl_init_success", deviceInfo);
        }}
        performance={{
          min: 0.8,
          max: 1.0,
          debounce: 100,
        }}
        shadows
        {...props}
      >
        <AdaptiveDpr />
        {children}
      </Canvas>
    </ErrorBoundary>
  );
}

export const ThreeCanvas = dynamic(
  () => Promise.resolve(ThreeCanvasComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner aria-hidden="true" className="size-6" />
      </div>
    ),
  }
);
