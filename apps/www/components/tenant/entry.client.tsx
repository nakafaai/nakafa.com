"use client";

import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { AuthGoogle } from "@/components/auth/google";
import { TenantLogin } from "@/components/tenant/login";

/**
 * The sign-in actions of a school host: Google beside the school username action. The
 * username form opens from its button, and from the address `?masuk=username`, which a
 * visitor who signs out to sign in with a card lands on.
 */
export function TenantEntryActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const [masuk, setMasuk] = useQueryState("masuk");
  const isOpen = masuk === "username";

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AuthGoogle returnPath="/" />
      {isOpen ? (
        <TenantLogin slug={slug} />
      ) : (
        <Button onClick={() => setMasuk("username")} variant="outline">
          {t("username-action")}
        </Button>
      )}
    </div>
  );
}
