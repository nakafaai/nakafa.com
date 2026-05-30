"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { isModelId, type ModelId } from "@repo/ai/config/model";
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
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context/use-ai";
import { useUser } from "@/lib/context/use-user";
import { aiModels, getAiModel } from "@/lib/data/models";

export function AiChatModel() {
  const t = useTranslations("Ai");
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser((state) => state.user);

  const model = useAi((state) => state.model);
  const setModel = useAi((state) => state.setModel);
  const setOpen = useAi((state) => state.setOpen);

  const selectedModel = getAiModel(model);

  const handleModelChange = (value: ModelId) => {
    if (!user) {
      setOpen(false);
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    setModel(value);
  };

  const handleValueChange = (value: string) => {
    if (!isModelId(value)) {
      return;
    }

    handleModelChange(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost">
            <HugeIcons icon={selectedModel.icon} />
            {selectedModel.label}
            <HugeIcons icon={ArrowDown01Icon} />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
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
