"use client";

import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";

interface Props {
  interpretation: string;
}

/**
 * Renders the tafsir drawer for one verse.
 *
 * The drawer is transient UI, so it resets closed when Next hides the page
 * through Cache Components state preservation.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 * - Mantine `useDisclosure`:
 *   https://mantine.dev/hooks/use-disclosure/
 */
export function QuranInterpretation({ interpretation }: Props) {
  const t = useTranslations("Holy");
  const [open, { close, set }] = useDisclosure(false);

  useLayoutEffect(() => close, [close]);

  return (
    <Drawer onOpenChange={set} open={open}>
      <DrawerTrigger asChild className="cursor-pointer">
        <Button size="icon" variant="outline">
          <HugeIcons icon={BookOpen02Icon} />
          <span className="sr-only">{t("interpretation")}</span>
        </Button>
      </DrawerTrigger>

      <DrawerContent className="mx-auto sm:max-w-3xl">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-center">
            {t("interpretation")}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-md border bg-accent p-4">
            <p className="text-pretty text-accent-foreground leading-relaxed">
              {interpretation}
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
