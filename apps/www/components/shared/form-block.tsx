import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  description: ReactNode;
  footer?: ReactNode;
  title: ReactNode;
  variant?: "default" | "destructive";
}

export function FormBlock({
  title,
  footer,
  children,
  variant = "default",
  description,
}: Props) {
  return (
    <Frame
      className={cn(
        "overflow-hidden",
        variant === "destructive" && "bg-destructive/12"
      )}
    >
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel
        className={cn(variant === "destructive" && "border-destructive")}
      >
        {children}
      </FramePanel>
      {!!footer && (
        <FrameFooter
          className={cn(
            "border-t bg-muted/20 py-3 [.border-t]:pt-3",
            variant === "destructive" && "border-destructive bg-destructive/20"
          )}
        >
          {footer}
        </FrameFooter>
      )}
    </Frame>
  );
}
