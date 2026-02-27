"use client";

import { StarsIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useAi } from "@/lib/context/use-ai";
import { useUser } from "@/lib/context/use-user";

interface Props {
  title: string;
}

export function AskCta({ title }: Props) {
  const t = useTranslations("Ai");
  const user = useUser((s) => s.user);
  const router = useRouter();

  const setText = useAi((state) => state.setText);

  const handleGoogleSignIn = () => {
    authClient.signIn.social({
      provider: "google",
    });
  };

  const handleAsk = () => {
    setText(title);

    if (!user) {
      handleGoogleSignIn();
      return;
    }

    router.push("/chat");
  };

  useEffect(() => {
    router.prefetch("/chat");
  }, [router]);

  return (
    <Button onClick={handleAsk}>
      <HugeIcons icon={StarsIcon} />
      {t("ask-ai")}
    </Button>
  );
}
