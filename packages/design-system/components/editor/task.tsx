import {
  editorTask,
  editorTaskBox,
  editorTaskWords,
} from "@repo/design-system/components/editor/frame";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import { useId } from "react";

/**
 * One task of the editor: the design system's check box beside the task's words, which name the
 * box for assistive technology. While the editor takes changes, a press on the box checks or
 * clears the task and keeps the caret where it was; a read-only editor shows the box as it is.
 */
function TaskNode({ editor, node, updateAttributes }: ReactNodeViewProps) {
  const words = useId();
  const editable = useEditorState({
    editor,
    selector: ({ editor: current }) => current?.isEditable ?? false,
  });

  return (
    <NodeViewWrapper className={editorTask()}>
      <span className={editorTaskBox()} contentEditable={false}>
        <Checkbox
          aria-labelledby={words}
          checked={node.attrs.checked === true}
          onCheckedChange={(checked) => updateAttributes({ checked })}
          onMouseDown={(event) => event.preventDefault()}
          readOnly={!editable}
        />
      </span>
      <NodeViewContent className={editorTaskWords()} id={words} />
    </NodeViewWrapper>
  );
}

/**
 * The view of a task item: a list item that keeps the attributes the editor writes for a task,
 * such as whether it is checked and the direction of its words, with the task drawn inside.
 */
export const TASK_VIEW = ReactNodeViewRenderer(TaskNode, {
  as: "li",
  attrs: ({ HTMLAttributes }) => ({
    ...HTMLAttributes,
    "data-type": "taskItem",
  }),
});
