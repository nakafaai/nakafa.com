"use client";

import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { ISOSCELES_RIGHT_TRIANGLE_ANGLE } from "@repo/math/angles";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import {
  Button,
  Group,
  I18nProvider,
  Input,
  Label,
  NumberField,
} from "react-aria-components";

function ScenePlaceholder() {
  return (
    <div
      aria-hidden="true"
      className={threeSceneFrameVariants({
        className: "grid place-items-center",
      })}
    >
      <Spinner className="size-6" />
    </div>
  );
}

// Next owns this client-only import boundary so offscreen lessons do not load WebGL.
const TriangleScene = dynamic(
  () =>
    import(
      "@repo/design-system/components/contents/mathematics/triangle/scene"
    ).then((module) => module.TriangleScene),
  {
    loading: ScenePlaceholder,
    ssr: false,
  }
);

// Keep KaTeX outside the page's initial component graph until the scene is visible.
const TriangleReadout = dynamic(
  () =>
    import(
      "@repo/design-system/components/contents/mathematics/triangle/readout"
    ).then((module) => module.TriangleReadout),
  { ssr: false }
);

interface Props {
  angle?: number;
  description: ReactNode;
  labels?: ComponentProps<typeof TriangleReadout>["labels"];
  size?: number;
  title: ReactNode;
}

export function Triangle({
  title,
  description,
  angle = ISOSCELES_RIGHT_TRIANGLE_ANGLE,
  size = 2,
  labels = {
    opposite: "Opposite",
    adjacent: "Adjacent",
    hypotenuse: "Hypotenuse",
  },
}: Props) {
  const locale = useLocale();

  return (
    <CoordinateProvider>
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <I18nProvider locale={locale}>
          <Content angle={angle} labels={labels} size={size} />
        </I18nProvider>
      </Card>
    </CoordinateProvider>
  );
}

function Content({
  angle,
  size,
  labels,
}: {
  angle: number;
  size: number;
  labels: NonNullable<Props["labels"]>;
}) {
  const t = useTranslations("Common");
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const angleValue = angleOverride ?? angle;

  return (
    <>
      <CardContent>
        <Intersection
          className="relative"
          data-slot="triangle-scene"
          once
          onIntersect={() => setIsNearViewport(true)}
        >
          {isNearViewport ? (
            <TriangleScene angle={angleValue} size={size} />
          ) : (
            <ScenePlaceholder />
          )}
        </Intersection>
      </CardContent>
      <CoordinateControls>
        <div className="flex w-full flex-col gap-4">
          {isNearViewport ? (
            <TriangleReadout angle={angleValue} labels={labels} />
          ) : null}
          <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6">
            <NumberField
              decrementAriaLabel={t("decrease-angle")}
              incrementAriaLabel={t("increase-angle")}
              onChange={(value) => {
                if (Number.isFinite(value)) {
                  setAngleOverride(value);
                }
              }}
              value={angleValue}
            >
              <Label className="sr-only">{t("angle")}</Label>
              <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
                <Button
                  className="-ms-px flex aspect-square h-full cursor-pointer items-center justify-center rounded-s-md border border-input bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  slot="decrement"
                >
                  <HugeIcons
                    aria-hidden="true"
                    className="size-4"
                    icon={MinusSignIcon}
                  />
                </Button>
                <Input
                  aria-roledescription={t("number-field")}
                  className="w-full grow bg-background px-3 py-2 text-center font-mono text-foreground tabular-nums"
                />
                <Button
                  className="-me-px flex aspect-square h-full cursor-pointer items-center justify-center rounded-e-md border border-input bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  slot="increment"
                >
                  <HugeIcons
                    aria-hidden="true"
                    className="size-4"
                    icon={PlusSignIcon}
                  />
                </Button>
              </Group>
            </NumberField>
          </div>
        </div>
      </CoordinateControls>
    </>
  );
}
