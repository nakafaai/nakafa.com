import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import Image from "next/image";
import type { ReactElement } from "react";

interface CatalogImageCardProps {
  readonly action: ReactElement;
  readonly actionLabel: string;
  readonly imageSrc: string;
  readonly preload: boolean;
  readonly title: string;
}

/** Renders one catalog choice with reviewed social artwork and an explicit action. */
export function CatalogImageCard({
  action,
  actionLabel,
  imageSrc,
  preload,
  title,
}: CatalogImageCardProps) {
  return (
    <Card className="relative mx-auto h-full w-full max-w-sm pt-0 pb-0 [--card-spacing:--spacing(4)]">
      <Image
        alt=""
        className="h-auto w-full"
        height={630}
        preload={preload}
        sizes="(min-width: 640px) 384px, calc(100vw - 48px)"
        src={imageSrc}
        width={1200}
      />
      <CardHeader className="flex-1">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
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
