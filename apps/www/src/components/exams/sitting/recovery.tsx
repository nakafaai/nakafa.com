import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { useSittingMode } from "@/components/exams/sitting/mode";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { PlayerMain } from "@/components/player/frame";
import { PlayerProvider } from "@/components/player/provider";
import { ReadRecovery } from "@/components/tenant/read/recovery";

/**
 * The paper's frame around every screen of a sitting that holds no paper: its entry, its waiting, its outcome,
 * and the moment before the paper arrives, so the whole sitting stands in one full screen under one bar, as a
 * try-out does, and the frame never changes on the way into the paper or out of it.
 */
export function PaperFrame({
  bar,
  children,
}: {
  /** The bar over the screen, the paper's own (`PaperBar`). */
  readonly bar: ReactNode;
  /** The screen under the bar, where the paper's questions stand; none while the paper is on its way. */
  readonly children?: ReactNode;
}) {
  const mode = useSittingMode();

  return (
    <PlayerProvider keys={[]} mode={mode}>
      {bar}
      <PlayerMain navigator={null}>{children}</PlayerMain>
    </PlayerProvider>
  );
}

/** The paper's frame under its bar, which stands in for the paper until it returns. */
function PaperHold({ children }: { readonly children: ReactNode }) {
  const t = useTranslations("Exams");

  return (
    <PaperFrame bar={<PaperBar back={<PaperBack />} title={t("sitting")} />}>
      {children}
    </PaperFrame>
  );
}

/**
 * Keeps a server failure of one read from taking the exam away. The student stays in the paper's frame and comes
 * back on their own: the page enters by itself, and every typed word waits in the browser.
 */
export function SittingRecovery({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <ReadRecovery frame={PaperHold} retry={SittingRetry}>
      {children}
    </ReadRecovery>
  );
}
