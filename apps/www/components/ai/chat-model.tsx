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
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
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
import { BrainIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useAi } from "@/lib/context/use-ai";
import { freeModels, models, premiumModels } from "@/lib/data/models";

export function AiChatModel() {
  const t = useTranslations("Ai");

  const pathname = usePathname();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const user = useQuery(api.auth.getCurrentUser);
  const hasSubscription = useQuery(
    api.subscriptions.queries.hasActiveSubscription,
    user ? { productId: products.pro.id } : "skip"
  );
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const [openModelMenu, setOpenModelMenu] = useState(false);

  const Icon = models.find((m) => m.value === model)?.icon ?? BrainIcon;
  const label = models.find((m) => m.value === model)?.label;

  const handleOnChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    const isPremium = premiumModels.some((m) => m.value === value);

    if (isPremium && !hasSubscription) {
      // Don't set premium model if no subscription, open checkout instead
      startTransition(async () => {
        const { url } = await generateCheckoutLink({
          productIds: [products.pro.id],
          successUrl: window.location.href,
        });
        window.open(url, "_blank");
      });
      return;
    }

    setModel(value);
  };

  return (
    <Popover onOpenChange={setOpenModelMenu} open={openModelMenu}>
      <PopoverTrigger asChild>
        <Button disabled={isPending} variant="ghost">
          {isPending ? <SpinnerIcon /> : <Icon />}
          {label}
          <ChevronDownIcon
            className={cn(
              "ml-auto size-4 transition-transform ease-out",
              !!openModelMenu && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="h-[300px] w-fit p-0">
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
