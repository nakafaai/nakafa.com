"use client";

import { Particles } from "@repo/design-system/components/ui/particles";
import { Authenticated, Unauthenticated } from "convex/react";
import { useTranslations } from "next-intl";
import { AuthGoogle } from "@/components/auth/google";
import { AuthLogout } from "@/components/auth/logout";

export default function Page() {
  const t = useTranslations("Metadata");

  return (
    <main
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto max-w-xl px-6">
        <div className="relative flex h-full flex-col items-center gap-6">
          <div className="flex flex-col items-center">
            <h1 className="font-semibold text-2xl">Nakafa</h1>
            <p className="text-muted-foreground">
              {t("very-short-description")}
            </p>
          </div>

          <Unauthenticated>
            <AuthGoogle />
          </Unauthenticated>

          <Authenticated>
            <AuthLogout />
          </Authenticated>
        </div>
      </div>
    </main>
  );
}
