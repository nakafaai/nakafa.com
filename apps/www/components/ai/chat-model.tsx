"use client";

import type { ModelId } from "@repo/ai/lib/providers";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/design-system/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useQuery } from "convex/react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth/client";
import { useAi } from "@/lib/context/use-ai";
import { freeModels, models, premiumModels } from "@/lib/data/models";

export function AiChatModel() {
  const t = useTranslations("Ai");

  const pathname = usePathname();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const syncCustomer = useAction(
    api.customers.actions.syncPolarCustomerFromUserId
  );
  const user = useQuery(api.auth.getCurrentUser);

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const [openModelMenu, setOpenModelMenu] = useState(false);

  const Icon = models.find((m) => m.value === model)?.icon;
  const label = models.find((m) => m.value === model)?.label;

  const handleCheckout = async ({ type }: { type: "premium" | "free" }) => {
    if (type === "free" || !user) {
      return;
    }

    try {
      // Sync customer between Polar and local DB before checkout
      // This is idempotent - safe to call multiple times
      await syncCustomer({ userId: user.appUser._id });

      // Check if user has active subscription
      const { data: customerState } = await authClient.customer.state();
      if (customerState) {
        const subscription = customerState.activeSubscriptions.find(
          (s) => s.productId === products.pro.id
        );
        if (subscription) {
          return;
        }
      }

      // Proceed to checkout
      await authClient.checkout({
        products: [products.pro.id],
        slug: products.pro.slug,
        // https://polar.sh/docs/features/checkout/links#prepopulate-fields
        customFieldData: {
          customer_email: user.authUser.email,
          customer_name: user.authUser.name,
        },
      });
    } catch {
      // TODO: Add proper error handling and user notification
      // You might want to show a toast notification here:
      // toast.error("Failed to start checkout. Please try again.");
      // Or log to your error tracking service
    }
  };

  const handleOnChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(`/auth?redirect=${pathname}`);
      return;
    }
    const isPremium = premiumModels.some((m) => m.value === value);
    setModel(value);
    startTransition(async () => {
      await handleCheckout({ type: isPremium ? "premium" : "free" });
    });
  };

  return (
    <Popover onOpenChange={setOpenModelMenu} open={openModelMenu}>
      <PopoverTrigger asChild>
        <Button disabled={isPending} variant="ghost">
          {!!Icon && <Icon />}
          {label}
          <ChevronDownIcon
            className={cn(
              "ml-auto size-4 transition-transform ease-out",
              !!openModelMenu && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit p-0">
        <Command>
          <CommandInput placeholder={t("search-models-placeholder")} />
          <CommandList>
            <CommandEmpty>{t("no-models-found")}</CommandEmpty>
            <CommandGroup heading={t("premium-models")}>
              {premiumModels.map((m) => (
                <CommandItem
                  className="cursor-pointer"
                  key={m.value}
                  onSelect={() => {
                    handleOnChange(m.value);
                  }}
                >
                  <m.icon />
                  {m.label}
                  <CheckIcon
                    className={cn(
                      "ml-auto size-4 opacity-0 transition-opacity ease-out",
                      model === m.value && "opacity-100"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t("free-models")}>
              {freeModels.map((m) => (
                <CommandItem
                  className="cursor-pointer"
                  key={m.value}
                  onSelect={() => {
                    handleOnChange(m.value);
                  }}
                >
                  <m.icon />
                  {m.label}
                  <CheckIcon
                    className={cn(
                      "ml-auto size-4 opacity-0 transition-opacity ease-out",
                      model === m.value && "opacity-100"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
