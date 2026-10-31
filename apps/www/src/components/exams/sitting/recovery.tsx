import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { ReadRecovery } from "@/components/exams/sitting/boundary";
import { useSittingMode } from "@/components/exams/sitting/mode";
import { PlayerMain } from "@/components/player/frame";
import { PlayerProvider } from "@/components/player/provider";

/** The paper's frame while the paper is not on screen: full screen, under its bar, with the paper to come. */
export function PaperFrame({ children }: { readonly children: ReactNode }) {
  const mode = useSittingMode();

  return (
    <PlayerProvider keys={[]} mode={mode}>
      {children}
      <PlayerMain navigator={null}>{null}</PlayerMain>
    </PlayerProvider>
  );
}

/** The paper's frame under its bar, which stands in for the paper until it returns. */
function PaperHold({ children }: { readonly children: ReactNode }) {
  const t = useTranslations("Exams");

  return (
    <PaperFrame>
      <PaperBar back={<PaperBack />} title={t("sitting")} />
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
  return <ReadRecovery frame={PaperHold}>{children}</ReadRecovery>;
}
