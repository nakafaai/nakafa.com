"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { useQuery } from "convex/react";
import { PartyPopperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";

export function UserSettingsSubscriptions() {
  const t = useTranslations("Auth");

  const user = useQuery(api.auth.getCurrentUser);

  const handleCheckout = async () => {
    if (!user) {
      return;
    }
    await authClient.checkout({
      products: [products.pro.id],
      slug: products.pro.slug,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("subscriptions")}</CardTitle>
        <CardDescription>{t("subscriptions-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Button onClick={handleCheckout} variant="default">
            <PartyPopperIcon />
            {t("get-pro")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
