"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

/**
 * Renders the home greeting.
 *
 * A protected route passes the account it already resolved so the greeting is
 * complete in the first paint. The live session stays the fallback for callers
 * that cannot resolve an account before rendering.
 */
export function HomeHeader({ userName }: { userName?: string | null }) {
  const t = useTranslations("Home");
  const currentUser = useUser((state) => state.user);
  const name = userName ?? currentUser?.appUser.name ?? t("guest");

  return (
    <div className="flex flex-col gap-2">
      <p>{t("greeting", { name })}</p>
      <h1 className="text-pretty font-medium text-4xl tracking-tight">
        {t("title")}
      </h1>
    </div>
  );
}
