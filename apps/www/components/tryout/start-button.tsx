"use client";

import { TryoutStartProvider } from "@/components/tryout/providers/start-state";
import { TryoutStartCta } from "@/components/tryout/start-cta";
import { TryoutStartDialog } from "@/components/tryout/start-dialog";

export function TryoutStartButton() {
  return (
    <TryoutStartProvider>
      <TryoutStartCta />
      <TryoutStartDialog />
    </TryoutStartProvider>
  );
}
