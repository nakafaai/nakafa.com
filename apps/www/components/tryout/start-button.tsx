"use client";

import { TryoutStartCta } from "@/components/tryout/start-cta";
import { TryoutStartDialog } from "@/components/tryout/start-dialog";
import {
  type TryoutStartButtonProps,
  TryoutStartProvider,
} from "@/components/tryout/start-state";

export type { TryoutStartButtonProps } from "@/components/tryout/start-state";

export function TryoutStartButton(props: TryoutStartButtonProps) {
  return (
    <TryoutStartProvider {...props}>
      <TryoutStartCta />
      <TryoutStartDialog />
    </TryoutStartProvider>
  );
}
