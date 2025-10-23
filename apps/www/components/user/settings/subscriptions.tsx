"use client";

import type { AppUser } from "@repo/backend/convex/auth";
import { products } from "@repo/backend/convex/utils/polar";
import { Button } from "@repo/design-system/components/ui/button";
import { PartyPopperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormBlock } from "@/components/shared/form-block";
import { authClient } from "@/lib/auth/client";

export function UserSettingsSubscriptions({ user }: { user: AppUser }) {
  const t = useTranslations("Auth");

  const handleCheckout = async () => {
    await authClient.checkout({
      products: [products.pro.id],
      slug: products.pro.slug,
      customFieldData: {
        customer_email: user.authUser.email,
        customer_name: user.authUser.name,
      },
    });
  };

  return (
    <FormBlock
      description={t("subscriptions-description")}
      title={t("subscriptions")}
    >
      <div className="flex items-center gap-4">
        <Button onClick={handleCheckout} variant="default">
          <PartyPopperIcon />
          {t("get-pro")}
        </Button>
      </div>
    </FormBlock>
  );
}
