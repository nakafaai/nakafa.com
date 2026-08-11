import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import Image from "next/image";
import type { ReactElement, ReactNode } from "react";

interface CatalogCardProps {
  readonly action: ReactElement;
  readonly actionLabel: string;
  readonly badge?: string;
  readonly children: ReactElement;
  readonly title: string;
}

/** Renders one image or gradient catalog choice with an explicit action. */
export function CatalogCard({
  action,
  actionLabel,
  badge,
  children,
  title,
}: CatalogCardProps) {
  return (
    <Card className="relative mx-auto h-full w-full max-w-sm pt-0 pb-0 [--card-spacing:--spacing(4)]">
      {children}
      <CardHeader className="flex-1">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {badge ? (
          <CardAction>
            <Badge variant="secondary">{badge}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardFooter className="border-t bg-muted/50 p-(--card-spacing)">
        <Button
          aria-label={`${actionLabel} ${title}`}
          className="w-full"
          nativeButton={false}
          render={action}
        >
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Renders reviewed 1200 by 630 artwork without cropping. */
export function CatalogCardImage({
  preload,
  src,
}: {
  preload: boolean;
  src: string;
}) {
  return (
    <Image
      alt=""
      className="h-auto w-full"
      height={630}
      preload={preload}
      sizes="(min-width: 640px) 384px, calc(100vw - 48px)"
      src={src}
      width={1200}
    />
  );
}

/** Renders a hard-edged gradient in the same 1200 by 630 visual frame. */
export function CatalogCardGradient({
  children,
  seed,
}: {
  children: ReactNode;
  seed: string;
}) {
  return (
    <div className="relative flex aspect-[40/21] w-full items-center justify-center">
      <GradientBlock
        className="pointer-events-none absolute inset-0"
        colorScheme="vibrant"
        intensity="medium"
        keyString={seed}
      />
      {children}
    </div>
  );
}
