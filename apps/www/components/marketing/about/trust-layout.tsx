"use client";

import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { useSplitter } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { CSSProperties, ReactNode } from "react";

interface TrustLayoutStyle extends CSSProperties {
  "--trust-primary-size": string;
  "--trust-source-size": string;
}

export function TrustLayout({
  lesson,
  resizeLabel,
  source,
}: {
  lesson: ReactNode;
  resizeLabel: string;
  source: ReactNode;
}) {
  const { getHandleProps, ref, sizes } = useSplitter<HTMLDivElement>({
    orientation: "horizontal",
    panels: [
      { defaultSize: 50, max: 64, min: 36 },
      { defaultSize: 50, max: 64, min: 36 },
    ],
    resetOnDoubleClick: false,
  });
  const [primarySize, sourceSize] = sizes;
  const handleProps = getHandleProps({ index: 0 });
  const layoutStyle: TrustLayoutStyle = {
    "--trust-primary-size": `${primarySize}fr`,
    "--trust-source-size": `${sourceSize}fr`,
  };

  return (
    <div
      className="grid divide-y lg:h-[50rem] lg:grid-cols-[minmax(0,var(--trust-primary-size))_1px_minmax(0,var(--trust-source-size))] lg:divide-y-0"
      data-trust-layout=""
      ref={ref}
      style={layoutStyle}
    >
      <div
        className="min-w-0"
        data-trust-primary-pane=""
        id="trust-primary-pane"
      >
        {lesson}
      </div>
      <div className="relative z-999 hidden w-px items-center justify-center bg-border lg:flex">
        <hr
          {...handleProps}
          aria-controls="trust-primary-pane"
          aria-label={resizeLabel}
          aria-orientation={handleProps["aria-orientation"]}
          aria-valuemax={handleProps["aria-valuemax"]}
          aria-valuemin={handleProps["aria-valuemin"]}
          aria-valuenow={handleProps["aria-valuenow"]}
          className="peer absolute -inset-x-2 inset-y-0 z-20 m-0 cursor-col-resize border-0 bg-transparent outline-none"
          data-trust-splitter=""
          tabIndex={handleProps.tabIndex}
        />
        <div
          aria-hidden="true"
          className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1"
        >
          <HugeIcons className="size-2.5" icon={DragDropVerticalIcon} />
        </div>
      </div>
      <div className="min-w-0" data-trust-source-pane="">
        {source}
      </div>
    </div>
  );
}
