"use client";

import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Language } from "@/components/marketing/shared/language";
import { ThemePicker } from "@/components/shared/theme/picker";

/** Renders footer preference actions that share the same language route resolver as the sidebar. */
export function FooterAction() {
  return (
    <ButtonGroup>
      <Language />
      <ThemePicker />
    </ButtonGroup>
  );
}
