"use client";

import {
  ArrowDown01Icon,
  BrainIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useConvex } from "convex/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useAi } from "@/lib/context/use-ai";
import { useUser } from "@/lib/context/use-user";
import { aiModels, getFreeModels, getPremiumModels } from "@/lib/data/models";

export function AiChatModel() {
  const t = useTranslations("Ai");

  const convex = useConvex();

  const pathname = usePathname();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const user = useUser((s) => s.user);

  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const [openModelMenu, setOpenModelMenu] = useState(false);

  const Icon = aiModels.find((m) => m.value === model)?.icon;
  const label = aiModels.find((m) => m.value === model)?.label;

  const handleOnChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    const isPremium = aiModels.some(
      (m) => m.value === value && m.type === "premium"
    );

    if (isPremium) {
      // Don't set premium model if no subscription, open checkout instead
      startTransition(async () => {
        const hasSubscription = await convex.query(
          api.subscriptions.queries.hasActiveSubscription,
          { productId: products.pro.id }
        );

        if (!hasSubscription) {
          const { url } = await generateCheckoutLink({
            productIds: [products.pro.id],
            successUrl: window.location.href,
          });
          window.open(url, "_blank");
          return;
        }
      });
    }

    setModel(value);
  };

  return (
    <Popover onOpenChange={setOpenModelMenu} open={openModelMenu}>
      <PopoverTrigger asChild>
        <Button disabled={isPending} variant="ghost">
          {isPending && <Spinner />}
          {!isPending && Icon && <Icon />}
          {!(isPending || Icon) && <HugeIcons icon={BrainIcon} />}
          {label}
          <HugeIcons
            className={cn(
              "ml-auto size-4 transition-transform ease-out",
              !!openModelMenu && "rotate-180"
            )}
            icon={ArrowDown01Icon}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="h-75 w-fit p-0">
        <Command>
          <CommandInput placeholder={t("search-models-placeholder")} />
          <CommandList>
            <CommandEmpty>{t("no-models-found")}</CommandEmpty>
            <CommandGroup heading={t("premium-models")}>
              {getPremiumModels().map((m) => (
                <CommandItem
                  className="cursor-pointer"
                  key={m.value}
                  onSelect={() => {
                    handleOnChange(m.value);
                    setOpenModelMenu(false);
                  }}
                >
                  <m.icon />
                  {m.label}
                  <HugeIcons
                    className={cn(
                      "ml-auto size-4 opacity-0 transition-opacity ease-out",
                      model === m.value && "opacity-100"
                    )}
                    icon={Tick01Icon}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t("free-models")}>
              {getFreeModels().map((m) => (
                <CommandItem
                  className="cursor-pointer"
                  key={m.value}
                  onSelect={() => {
                    handleOnChange(m.value);
                    setOpenModelMenu(false);
                  }}
                >
                  <m.icon />
                  {m.label}
                  <HugeIcons
                    className={cn(
                      "ml-auto size-4 opacity-0 transition-opacity ease-out",
                      model === m.value && "opacity-100"
                    )}
                    icon={Tick01Icon}
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
