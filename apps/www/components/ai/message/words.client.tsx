"use client";

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useId, useLayoutEffect, useRef, useState } from "react";

/**
 * A learner's own words, shown as they wrote them: no Markdown, no formulas,
 * no HTML. Line breaks and spaces stay, a long word breaks where it must, and
 * the text takes the direction of its own content.
 *
 * A message taller than twelve lines shows its first twelve, and the learner
 * opens the rest. Twelve lines are 292.5 pixels at the chat text size: 330
 * characters of exercises pasted one to a line on a phone 320 pixels wide, and
 * 660 at the width of the chat page. A pasted exercise fits, and a pasted
 * chapter no longer pushes the answer thousands of pixels away. The whole text
 * stays in the page whether it is folded or not, so find and copy reach all
 * of it.
 */
export function NinaWords({ children }: { children: string }) {
  const t = useTranslations("Ai");
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [open, { toggle }] = useDisclosure(false);
  const [tall, setTall] = useState(false);

  // A folded box is shorter than its text exactly when the text is tall, and
  // its text changes height when the width changes. An open box has nothing to
  // compare, so it keeps what the fold found.
  useLayoutEffect(() => {
    const folded = box.current;
    const words = text.current;

    if (open || !(folded && words)) {
      return;
    }

    const measure = () => setTall(folded.scrollHeight > folded.clientHeight);

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(words);

    return () => observer.disconnect();
  }, [open]);

  return (
    <div className="flex flex-col items-start gap-2" dir="auto">
      <div
        className={cn(
          "w-full overflow-hidden",
          !open && "max-h-[12lh]",
          !open && tall && "mask-b-from-70%"
        )}
        id={id}
        ref={box}
      >
        <div className="whitespace-pre-wrap" ref={text}>
          {children}
        </div>
      </div>
      {tall ? (
        <Button
          aria-controls={id}
          aria-expanded={open}
          onClick={toggle}
          size="sm"
          variant="outline"
        >
          {open ? t("show-less") : t("show-more")}
          <HugeIcons icon={open ? ArrowUp01Icon : ArrowDown01Icon} />
        </Button>
      ) : null}
    </div>
  );
}
