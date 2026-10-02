"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { ModelId } from "@repo/backend/confect/gateway/model";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Schema } from "effect";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { aiModels, getAiModel } from "@/lib/data/models";
import { useViewer } from "@/lib/identity/client";

export function AiChatModel() {
  const t = useTranslations("Ai");
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();
  const user = useViewer((state) => state.account);

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const selectedModel = getAiModel(model);

  const handleModelChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(authNavigation.readHref());
      return;
    }

    setModel(value);
  };

  const handleValueChange = (value: string) => {
    if (!Schema.is(ModelId)(value)) {
      return;
    }

    handleModelChange(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="rounded-full" size="default" variant="ghost">
            <HugeIcons icon={selectedModel.icon} />
            {selectedModel.label}
            <HugeIcons icon={ArrowDown01Icon} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            onValueChange={handleValueChange}
            value={model}
          >
            {aiModels.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                <HugeIcons icon={item.icon} />
                <span className="grid gap-0.5">
                  <span>{item.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(item.subtitleKey)}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
