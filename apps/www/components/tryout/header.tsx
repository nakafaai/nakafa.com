"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function TryoutHeader() {
  const tHome = useTranslations("Home");
  const tTryouts = useTranslations("Tryouts");
  const currentUser = useUser((state) => state.user);
  const userName = currentUser?.appUser.name || tHome("guest");

  return (
    <div className="flex flex-col gap-2">
      <p>{tHome("greeting", { name: userName })}</p>
      <h1 className="text-pretty font-medium text-3xl tracking-tight">
        {tTryouts("title")}
      </h1>
      <p className="max-w-2xl text-muted-foreground">
        {tTryouts("description")}
      </p>
    </div>
  );
}
