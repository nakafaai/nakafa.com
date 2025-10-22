"use client";

import type { ModelId } from "@repo/ai/lib/providers";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/polar";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from "@repo/design-system/components/ai/input";
import {
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@repo/design-system/components/ui/select";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { useAi } from "@/lib/context/use-ai";
import { freeModels, models, premiumModels } from "@/lib/data/models";

export function AiChatModel() {
  const t = useTranslations("Ai");

  const pathname = usePathname();
  const router = useRouter();

  const user = useQuery(api.auth.getCurrentUser);

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const Icon = models.find((m) => m.value === model)?.icon;
  const label = models.find((m) => m.value === model)?.label;

  const handleCheckout = async ({ type }: { type: "premium" | "free" }) => {
    if (type === "free" || !user) {
      return;
    }
    const { data: customerState } = await authClient.customer.state();
    if (customerState) {
      const subscription = customerState.activeSubscriptions.find(
        (s) => s.productId === products.pro.id
      );
      if (subscription) {
        return;
      }
    }
    await authClient.checkout({
      products: [products.pro.id],
      slug: products.pro.slug,
      // https://polar.sh/docs/features/checkout/links#prepopulate-fields
      customFieldData: {
        customer_email: user.email,
        customer_name: user.name,
      },
    });
  };

  const handleOnChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(`/auth?redirect=${pathname}`);
      return;
    }
    const isPremium = premiumModels.some((m) => m.value === value);
    handleCheckout({ type: isPremium ? "premium" : "free" });
    setModel(value);
  };

  return (
    <PromptInputModelSelect onValueChange={handleOnChange} value={model}>
      <PromptInputModelSelectTrigger>
        <PromptInputModelSelectValue>
          {Icon && <Icon />}
          {label}
        </PromptInputModelSelectValue>
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent>
        <SelectGroup>
          <SelectLabel>{t("premium-models")}</SelectLabel>
          {premiumModels.map((m) => (
            <PromptInputModelSelectItem key={m.value} value={m.value}>
              <m.icon />
              {m.label}
            </PromptInputModelSelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{t("free-models")}</SelectLabel>
          {freeModels.map((m) => (
            <PromptInputModelSelectItem key={m.value} value={m.value}>
              <m.icon />
              {m.label}
            </PromptInputModelSelectItem>
          ))}
        </SelectGroup>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}
