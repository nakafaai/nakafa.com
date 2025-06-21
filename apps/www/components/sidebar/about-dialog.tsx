"use client";

import { env } from "@/env";
import { useMediaQuery } from "@mantine/hooks";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import Image from "next/image";

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
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  action: (open: boolean) => void;
};

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
          src="/logo.svg"
          alt="Nakafa"
          title="Nakafa"
          fill
          priority
          className="object-contain"
        />
      </div>
      <Link
        href="/contributor"
        prefetch
        title={t("contributor")}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mx-auto w-fit"
        )}
        onClick={() => onOpenChange(false)}
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
      <Dialog open={open} onOpenChange={action}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="sm:text-center">
            <DialogTitle>{t("about")}</DialogTitle>
            <DialogDescription>
              {t("version", { version: env.NEXT_PUBLIC_VERSION })}
            </DialogDescription>
          </DialogHeader>
          <AboutDialogContent onOpenChange={action} className="pb-0" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={action}>
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
