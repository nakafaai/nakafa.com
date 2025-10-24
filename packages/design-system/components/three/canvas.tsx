"use client";

import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { FrownIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SpinnerIcon } from "../ui/icons";

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  const t = useTranslations("Error");
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
      <div className="space-y-4 text-center">
        <h1 className="font-bold font-mono text-2xl text-primary">5XX</h1>

        <div className="space-y-2">
          <h2 className="font-mono font-semibold tracking-tight">
            {t("title")}
          </h2>

          <p className="mx-auto max-w-md text-muted-foreground text-sm">
            {error.message}
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

function ThreeCanvasComponent({
  children,
  frameloop = "demand",
  ...props
}: {
  children: ReactNode;
  frameloop?: "always" | "demand" | "never";
} & CanvasProps) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      <Canvas
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <FrownIcon aria-hidden="true" className="size-6 shrink-0" />
          </div>
        }
        frameloop={frameloop}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
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
        <SpinnerIcon aria-hidden="true" className="size-6 shrink-0" />
      </div>
    ),
  }
);
