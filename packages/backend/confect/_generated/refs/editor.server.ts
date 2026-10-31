import { GroupSpec, Refs, Spec } from "@confect/core";
import editor_deletion from "../../editor/deletion.spec";
import editor_fold from "../../editor/fold.spec";
import editor_prune from "../../editor/prune.spec";

const spec: Spec.Spec<{
  readonly editor: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "editor", never, GroupSpec.NamedAt<typeof editor_deletion, "deletion"> | GroupSpec.NamedAt<typeof editor_fold, "fold"> | GroupSpec.NamedAt<typeof editor_prune, "prune">>, "editor">;
}> = Spec.fromGroups({ ["editor"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["deletion"]: editor_deletion, ["fold"]: editor_fold, ["prune"]: editor_prune }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.editor;
