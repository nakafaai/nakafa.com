import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";

export const card = {
  name: "ResizablePanelGroup",
  group: "Content",
  height: 240,
  source: "resizable",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <ResizablePanelGroup
        className="min-h-44 rounded-lg border"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize="40%">
          <div className="flex h-full items-center justify-center p-6 text-sm">
            Lesson
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="60%">
          <div className="flex h-full items-center justify-center p-6 text-sm">
            Nina
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
