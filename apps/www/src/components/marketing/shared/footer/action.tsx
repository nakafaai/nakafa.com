import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { ReactNode } from "react";
import { Language } from "@/components/marketing/shared/language";
import { ThemePicker } from "@/components/shared/theme/picker";

/**
 * The footer's preferences in one outline group: the language, the theme, and what the caller adds after them,
 * such as the visitor's usage data choice, so every preference reads as a control of one kind. A phone shows the
 * language as its icon, so the three fit one row at 320 px.
 */
export function FooterAction({ children }: { children?: ReactNode }) {
  return (
    <ButtonGroup>
      <Language compact />
      <ThemePicker />
      {children}
    </ButtonGroup>
  );
}
