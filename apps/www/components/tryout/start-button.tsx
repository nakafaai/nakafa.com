"use client";

import { TryoutStartCta } from "@/components/tryout/start-cta";
import { TryoutStartDialog } from "@/components/tryout/start-dialog";
import {
  type TryoutStartButtonProps,
  useTryoutStartValue,
} from "@/components/tryout/start-state";

export type { TryoutStartButtonProps } from "@/components/tryout/start-state";

export function TryoutStartButton(props: TryoutStartButtonProps) {
  const value = useTryoutStartValue(props);

  return (
    <>
      <TryoutStartCta value={value} />
      <TryoutStartDialog value={value} />
    </>
  );
}
