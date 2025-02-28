"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";
import { Provider as BalancerProvider } from "react-wrap-balancer";
import { TooltipProvider } from "../ui/tooltip";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <TooltipProvider>
        <BalancerProvider>{children}</BalancerProvider>
      </TooltipProvider>
    </NextThemesProvider>
  );
}
