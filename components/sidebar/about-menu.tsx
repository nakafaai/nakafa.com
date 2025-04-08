"use client";

import { SquareTerminalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import AboutDialog from "./about-dialog";

export function AboutMenu() {
  const t = useTranslations("Common");
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setOpen(!open)} tooltip={t("about")}>
          <SquareTerminalIcon className="size-4 shrink-0" />
          <span className="truncate">{t("about")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <AboutDialog open={open} action={setOpen} />
    </>
  );
}
