"use client";

import Image from "next/image";
import { useMediaQuery } from "usehooks-ts";

import { cn } from "@/lib/utils";
import packageJson from "@/package.json";
import nakafaLogo from "@/public/logo.svg";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "../ui/drawer";

type Props = {
  open: boolean;
  action: (open: boolean) => void;
};

function Content({ className }: { className?: string }) {
  const t = useTranslations("Common");

  return (
    <div className={cn("grid gap-4 px-4 pb-4 text-center", className)}>
      <div className="flex justify-center">
        <div className="relative aspect-square size-16 rounded-lg border">
          <Image
            src={nakafaLogo}
            alt="Nakafa"
            fill
            priority
            className="rounded-lg object-contain"
          />
        </div>
      </div>
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

export default function AboutDialog({ open, action }: Props) {
  const t = useTranslations("Common");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={action}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="sm:text-center">
            <DialogTitle>{t("about")}</DialogTitle>
            <DialogDescription>
              {t("version", { version: packageJson.version })}
            </DialogDescription>
          </DialogHeader>
          <Content className="pb-0" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={action}>
      <DrawerContent>
        <DrawerHeader className="sm:text-center">
          <DrawerTitle>{t("about")}</DrawerTitle>
          <DrawerDescription>
            {t("version", { version: packageJson.version })}
          </DrawerDescription>
        </DrawerHeader>
        <Content />
      </DrawerContent>
    </Drawer>
  );
}
