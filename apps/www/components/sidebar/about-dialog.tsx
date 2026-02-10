"use client";

import { useMediaQuery } from "@mantine/hooks";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { env } from "@/env";

interface Props {
  open: boolean;
  action: (open: boolean) => void;
}

function AboutDialogContent({
  onOpenChange,
  className,
}: {
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("Common");

  return (
    <div
      className={cn(
        "grid justify-center gap-4 px-4 pb-4 text-center",
        className
      )}
    >
      <div className="relative mx-auto aspect-square size-16 overflow-hidden rounded-lg border">
        <Image
          alt="Nakafa"
          className="object-contain"
          fetchPriority="high"
          fill
          loading="eager"
          src="/logo.svg"
          title="Nakafa"
        />
      </div>
      <Link
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mx-auto w-fit"
        )}
        href="/contributor"
        onClick={() => onOpenChange(false)}
        prefetch
        title={t("contributor")}
      >
        {t("contributor")}
      </Link>
      <div className="flex flex-col justify-center gap-1">
        <span className="text-muted-foreground text-xs">
          {t("made-with-love")}
        </span>
        <p className="text-muted-foreground text-xs">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  );
}

export function AboutDialog({ open, action }: Props) {
  const t = useTranslations("Common");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog onOpenChange={action} open={open}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader className="sm:text-center">
            <DialogTitle>{t("about")}</DialogTitle>
            <DialogDescription>
              {t("version", { version: env.NEXT_PUBLIC_VERSION })}
            </DialogDescription>
          </DialogHeader>
          <AboutDialogContent className="pb-0" onOpenChange={action} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer onOpenChange={action} open={open}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>{t("about")}</DrawerTitle>
          <DrawerDescription>
            {t("version", { version: env.NEXT_PUBLIC_VERSION })}
          </DrawerDescription>
        </DrawerHeader>
        <AboutDialogContent onOpenChange={action} />
      </DrawerContent>
    </Drawer>
  );
}
