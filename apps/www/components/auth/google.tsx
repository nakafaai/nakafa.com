"use client";

import { SiGoogle } from "@icons-pack/react-simple-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";

export function AuthGoogle() {
  const t = useTranslations("Auth");

  return (
    <Button>
      <SiGoogle />
      {t("continue-with-google")}
    </Button>
  );
}
