"use client";

import { ArrowRight01Icon, PaintBoardIcon } from "@hugeicons/core-free-icons";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { themes } from "@repo/design-system/lib/theme";
import { cn } from "@repo/design-system/lib/utils";
import { IconCircleFilled } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

const BASE_THEMES_COUNT = 3;

function CheckerBadge({ isActive }: { isActive: boolean }) {
  return (
    <IconCircleFilled
      className={cn(
        "ml-auto size-3 text-primary opacity-0 transition-opacity",
        !!isActive && "opacity-100"
      )}
    />
  );
}

export function ThemeMenu() {
  const { theme: currentTheme, setTheme } = useTheme();
  const t = useTranslations("Common");

  const isMobile = useMediaQuery("(max-width: 640px)");
  const [open, { set }] = useDisclosure(false);

  function isActive(value: string) {
    return currentTheme === value;
  }

  return (
    <Menu onOpenChange={set} open={open}>
      <SidebarMenuItem>
        <MenuTrigger
          render={
            <SidebarMenuButton tooltip={t("theme")}>
              <HugeIcons icon={PaintBoardIcon} />
              <span className="truncate">{t("theme")}</span>

              <HugeIcons className="ml-auto" icon={ArrowRight01Icon} />
            </SidebarMenuButton>
          }
        />

        <MenuPopup
          align="end"
          className="max-h-96 w-max max-w-[calc(100vw-2rem)]"
          side={isMobile ? "top" : "right"}
        >
          <MenuGroup>
            {themes.slice(0, BASE_THEMES_COUNT).map((theme) => (
              <MenuItem key={theme.value} onClick={() => setTheme(theme.value)}>
                <HugeIcons className="shrink-0" icon={theme.icon} />
                <span className="truncate">{t(theme.value)}</span>
                <CheckerBadge isActive={isActive(theme.value)} />
              </MenuItem>
            ))}
          </MenuGroup>

          <MenuSeparator />

          <MenuGroup>
            {themes.slice(BASE_THEMES_COUNT).map((theme) => (
              <MenuItem key={theme.value} onClick={() => setTheme(theme.value)}>
                <HugeIcons className="shrink-0" icon={theme.icon} />
                <span className="truncate">{t(theme.value)}</span>
                <CheckerBadge isActive={isActive(theme.value)} />
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuPopup>
      </SidebarMenuItem>
    </Menu>
  );
}
