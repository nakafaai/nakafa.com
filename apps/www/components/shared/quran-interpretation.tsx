import { BookOpen02Icon } from "@hugeicons/core-free-icons";
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

interface Props {
  interpretation: string;
}

export function QuranInterpretation({ interpretation }: Props) {
  const t = useTranslations("Holy");

  return (
    <Drawer>
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
