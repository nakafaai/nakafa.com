import { GroupSpec, Refs, Spec } from "@confect/core";
import editor_documents from "../../editor/documents.spec";
import editor_steps from "../../editor/steps.spec";

const spec: Spec.Spec<{
  readonly editor: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "editor", never, GroupSpec.NamedAt<typeof editor_documents, "documents"> | GroupSpec.NamedAt<typeof editor_steps, "steps">>, "editor">;
}> = Spec.make().addAt("editor", GroupSpec.makeAt("editor").addGroupAt("documents", editor_documents).addGroupAt("steps", editor_steps));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.editor;
