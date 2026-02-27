"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function HomeHeader() {
  const t = useTranslations("Home");
  const currentUser = useUser((state) => state.user);
  const userName = currentUser?.appUser.name || t("guest");

  return (
    <div className="flex flex-col gap-2">
      <p>{t("greeting", { name: userName })}</p>
      <h1 className="text-pretty font-medium text-4xl leading-none tracking-tighter">
        {t("title")}
      </h1>
    </div>
  );
}
