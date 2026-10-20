import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  type TriangleLabels,
  TriangleProvider,
  useTriangle,
} from "@repo/design-system/components/contents/mathematics/triangle/context";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { ISOSCELES_RIGHT_TRIANGLE_ANGLE } from "@repo/math/angles";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Button,
  Group,
  I18nProvider,
  Input,
  Label,
  NumberField,
} from "react-aria-components";
import { useLocale, useTranslations } from "use-intl";

// Next owns this client-only import boundary so offscreen lessons do not load WebGL.
const TriangleScene = lazyComponent(
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
const TriangleReadout = lazyComponent(
  () =>
    import(
      "@repo/design-system/components/contents/mathematics/triangle/readout"
    ).then((module) => module.TriangleReadout),
  { ssr: false }
);

interface Props {
  angle?: number;
  description: ReactNode;
  labels?: TriangleLabels;
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
  const config = { angle, labels, size };

  return (
    <CoordinateProvider>
      <TriangleProvider config={config}>
        <VisualCard>
          <VisualCardHeader description={description} title={title} />
          <I18nProvider locale={locale}>
            <Content />
          </I18nProvider>
        </VisualCard>
      </TriangleProvider>
    </CoordinateProvider>
  );
}

function Content() {
  const t = useTranslations("Common");
  const { angle } = useTriangle();
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const angleValue = angleOverride ?? angle;

  return (
    <>
      <VisualCardToolbar>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
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
            <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-3 data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
              <Button
                className="flex aspect-square h-full cursor-pointer items-center justify-center border-input border-e bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex aspect-square h-full cursor-pointer items-center justify-center border-input border-s bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
      </VisualCardToolbar>
      <VisualCardBody className="relative" data-scene="triangle">
        {isNearViewport ? (
          <TriangleScene angle={angleValue} />
        ) : (
          <ScenePlaceholder />
        )}
        {/* Last, so the scene or its stand-in is the body's first child. */}
        <Intersection
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          once
          onIntersect={() => setIsNearViewport(true)}
        />
      </VisualCardBody>
      <CoordinateControls />
      {isNearViewport ? (
        <VisualCardFooter>
          <TriangleReadout angle={angleValue} />
        </VisualCardFooter>
      ) : null}
    </>
  );
}
