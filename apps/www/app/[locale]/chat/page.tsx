"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { LogInIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { AiChat } from "@/components/ai/chat";

export default function Page() {
  const t = useTranslations("Auth");

  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh">
      <Authenticated>
        <AiChat />
      </Authenticated>
      <Unauthenticated>
        <div className="flex h-full items-center justify-center">
          <Button asChild>
            <NavigationLink href="/auth">
              <LogInIcon />
              {t("login")}
            </NavigationLink>
          </Button>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex h-full items-center justify-center">
          <SpinnerIcon className="size-6 shrink-0" />
        </div>
      </AuthLoading>
    </main>
  );
}
