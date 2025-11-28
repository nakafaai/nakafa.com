"use client";

import { HorizontalRule } from "@repo/design-system/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
// --- Tiptap Node ---
import { ImageUploadNode } from "@repo/design-system/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { NodeBackground } from "@repo/design-system/components/tiptap-node/node-background";
// --- UI Primitives ---
import { Button } from "@repo/design-system/components/tiptap-ui-primitive/button";
import { Spacer } from "@repo/design-system/components/tiptap-ui-primitive/spacer";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@repo/design-system/components/tiptap-ui-primitive/toolbar";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import { Selection } from "@tiptap/extensions";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import "@repo/design-system/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@repo/design-system/components/tiptap-node/code-block-node/code-block-node.scss";
import "@repo/design-system/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@repo/design-system/components/tiptap-node/list-node/list-node.scss";
import "@repo/design-system/components/tiptap-node/image-node/image-node.scss";
import "@repo/design-system/components/tiptap-node/heading-node/heading-node.scss";
import "@repo/design-system/components/tiptap-node/paragraph-node/paragraph-node.scss";

// --- Icons ---
import { ArrowLeftIcon } from "@repo/design-system/components/tiptap-icons/arrow-left-icon";
import { HighlighterIcon } from "@repo/design-system/components/tiptap-icons/highlighter-icon";
import { LinkIcon } from "@repo/design-system/components/tiptap-icons/link-icon";
// --- Components ---
import { ThemeToggle } from "@repo/design-system/components/tiptap-templates/simple/theme-toggle";
import { BlockquoteButton } from "@repo/design-system/components/tiptap-ui/blockquote-button";
import { CodeBlockButton } from "@repo/design-system/components/tiptap-ui/code-block-button";
import {
  ColorHighlightPopover,
  ColorHighlightPopoverButton,
  ColorHighlightPopoverContent,
} from "@repo/design-system/components/tiptap-ui/color-highlight-popover";
// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@repo/design-system/components/tiptap-ui/heading-dropdown-menu";
import { ImageUploadButton } from "@repo/design-system/components/tiptap-ui/image-upload-button";
import {
  LinkButton,
  LinkContent,
  LinkPopover,
} from "@repo/design-system/components/tiptap-ui/link-popover";
import { ListDropdownMenu } from "@repo/design-system/components/tiptap-ui/list-dropdown-menu";
import { MarkButton } from "@repo/design-system/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@repo/design-system/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@repo/design-system/components/tiptap-ui/undo-redo-button";
import { useCursorVisibility } from "@repo/design-system/hooks/use-cursor-visibility";
// --- Hooks ---
import { useIsBreakpoint } from "@repo/design-system/hooks/use-is-breakpoint";
import { useWindowSize } from "@repo/design-system/hooks/use-window-size";

// --- Lib ---
import {
  handleImageUpload,
  MAX_FILE_SIZE,
} from "@repo/design-system/lib/tiptap-utils";

// --- Styles ---
import "@repo/design-system/components/tiptap-templates/simple/simple-editor.scss";

import content from "@repo/design-system/components/tiptap-templates/simple/data/content.json";

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void;
  onLinkClick: () => void;
  isMobile: boolean;
}) => (
  <>
    <Spacer />

    <ToolbarGroup>
      <UndoRedoButton action="undo" />
      <UndoRedoButton action="redo" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
      <ListDropdownMenu
        portal={isMobile}
        types={["bulletList", "orderedList", "taskList"]}
      />
      <BlockquoteButton />
      <CodeBlockButton />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="bold" />
      <MarkButton type="italic" />
      <MarkButton type="strike" />
      <MarkButton type="code" />
      <MarkButton type="underline" />
      {isMobile ? (
        <ColorHighlightPopoverButton onClick={onHighlighterClick} />
      ) : (
        <ColorHighlightPopover />
      )}
      {isMobile ? <LinkButton onClick={onLinkClick} /> : <LinkPopover />}
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="superscript" />
      <MarkButton type="subscript" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <TextAlignButton align="left" />
      <TextAlignButton align="center" />
      <TextAlignButton align="right" />
      <TextAlignButton align="justify" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <ImageUploadButton text="Add" />
    </ToolbarGroup>

    <Spacer />

    {!!isMobile && <ToolbarSeparator />}

    <ToolbarGroup>
      <ThemeToggle />
    </ToolbarGroup>
  </>
);

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link";
  onBack: () => void;
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
);

export function SimpleEditor() {
  const isMobile = useIsBreakpoint();
  const { height } = useWindowSize();
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  );
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    enableContentCheck: true,
    onContentError({ error }) {
      // Log the error for debugging
      console.error("Content schema error:", error);

      // For non-collaborative editing, Tiptap will automatically strip
      // unknown content to maintain a valid state. We can optionally
      // disable the editor or show user notification if needed.
      // Since this is a simple editor, we'll just log the error.
    },
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      NodeBackground.configure({
        types: ["paragraph", "heading"],
      }),
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    content,
  });

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  });

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main");
    }
  }, [isMobile, mobileView]);

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              isMobile={isMobile}
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
            />
          ) : (
            <MobileToolbarContent
              onBack={() => setMobileView("main")}
              type={mobileView === "highlighter" ? "highlighter" : "link"}
            />
          )}
        </Toolbar>

        <EditorContent
          className="simple-editor-content"
          editor={editor}
          role="presentation"
        />
      </EditorContext.Provider>
    </div>
  );
}
