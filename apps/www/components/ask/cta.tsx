"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useQuery } from "convex/react";
import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useAi } from "@/lib/context/use-ai";

type Props = {
  title: string;
};

export function AskCta({ title }: Props) {
  const t = useTranslations("Ai");
  const user = useQuery(api.auth.getCurrentUser);
  const router = useRouter();

  const setText = useAi((state) => state.setText);

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
    });
  };

  const handleAsk = () => {
    setText(title);

    if (!user) {
      handleGoogleSignIn();
      return;
    }

    router.push("/");
  };

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  return (
    <Button onClick={handleAsk}>
      <SparklesIcon />
      {t("ask-ai")}
    </Button>
  );
}
