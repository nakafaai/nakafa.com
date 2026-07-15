"use client";

import {
  Attachment01Icon,
  Cancel01Icon,
  Image02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupAddon } from "@repo/design-system/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import {
  type ComponentProps,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Props for rendering one pending prompt attachment. */
export type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: PromptInputFile;
  className?: string;
};

/** Renders one image preview or named file with a removable action. */
export function PromptInputAttachment({
  data,
  className,
  ...props
}: PromptInputAttachmentProps) {
  const attachments = usePromptInputAttachments();
  const mediaType =
    data.mediaType?.startsWith("image/") && data.url ? "image" : "file";

  return (
    <div
      className={cn(
        "group relative h-14 w-14 rounded-md border",
        className,
        mediaType === "image" ? "h-14 w-14" : "h-8 w-auto max-w-full"
      )}
      key={data.id}
      {...props}
    >
      {mediaType === "image" ? (
        <Image
          alt={data.filename || "attachment"}
          className="size-full rounded-md object-cover"
          fetchPriority="high"
          height={56}
          loading="eager"
          preload
          src={data.url}
          width={56}
        />
      ) : (
        <div className="flex size-full max-w-full cursor-pointer items-center justify-start gap-2 overflow-hidden px-2 text-muted-foreground">
          <HugeIcons className="size-4 shrink-0" icon={Attachment01Icon} />
          <Tooltip>
            <TooltipTrigger className="min-w-0 flex-1">
              <h4 className="w-full truncate text-left font-medium text-sm">
                {data.filename || "Unknown file"}
              </h4>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <h4 className="wrap-break-word max-w-60 overflow-hidden whitespace-normal text-left font-semibold text-sm">
                  {data.filename || "Unknown file"}
                </h4>
                {!!data.mediaType && <div>{data.mediaType}</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <Button
        aria-label="Remove attachment"
        className="absolute -top-1.5 -right-1.5 size-6 rounded-full opacity-0 focus-visible:opacity-100 focus-visible:transition-none group-hover:opacity-100"
        onClick={() => attachments.remove(data.id)}
        size="icon"
        type="button"
        variant="outline"
      >
        <HugeIcons className="size-3" icon={Cancel01Icon} />
      </Button>
    </div>
  );
}

/** Props for laying out every pending prompt attachment. */
export type PromptInputAttachmentsProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "children" | "align"
> & {
  children: (attachment: PromptInputFile) => ReactNode;
};

/** Groups pending files before image previews and animates list height. */
export function PromptInputAttachments({
  className,
  children,
  ...props
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments();
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setHeight(element.getBoundingClientRect().height);
    });
    resizeObserver.observe(element);
    setHeight(element.getBoundingClientRect().height);
    return () => resizeObserver.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Force height measurement when attachments change
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    setHeight(element.getBoundingClientRect().height);
  }, [attachments.files.length]);

  if (attachments.files.length === 0) {
    return null;
  }

  const fileAttachments: PromptInputFile[] = [];
  const imageAttachments: PromptInputFile[] = [];

  for (const file of attachments.files) {
    if (file.mediaType?.startsWith("image/") && file.url) {
      imageAttachments.push(file);
    } else {
      fileAttachments.push(file);
    }
  }

  return (
    <InputGroupAddon
      align="block-start"
      aria-live="polite"
      className={cn(
        "overflow-hidden transition-[height] duration-200 ease-out",
        className
      )}
      style={{ height: attachments.files.length ? height : 0 }}
      {...props}
    >
      <div className="flex flex-col gap-2 py-1" ref={contentRef}>
        <div className="flex flex-wrap gap-2">
          {fileAttachments.map((file) => (
            <Fragment key={file.id}>{children(file)}</Fragment>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {imageAttachments.map((file) => (
            <Fragment key={file.id}>{children(file)}</Fragment>
          ))}
        </div>
      </div>
    </InputGroupAddon>
  );
}

/** Props for the menu action that opens the prompt file picker. */
export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

/** Opens the hidden prompt file input without closing its action menu. */
export function PromptInputActionAddAttachments({
  label = "Add photos or files",
  ...props
}: PromptInputActionAddAttachmentsProps) {
  const attachments = usePromptInputAttachments();

  return (
    <DropdownMenuItem
      {...props}
      closeOnClick={false}
      onClick={(event) => {
        event.preventDefault();
        attachments.openFileDialog();
      }}
    >
      <HugeIcons className="mr size-4" icon={Image02Icon} />
      {label}
    </DropdownMenuItem>
  );
}
