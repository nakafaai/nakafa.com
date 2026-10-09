import { GroupSpec, Refs, Spec } from "@confect/core";
import journal_audit from "../../journal/audit.spec";

const spec: Spec.Spec<{
  readonly journal: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "journal", never, GroupSpec.NamedAt<typeof journal_audit, "audit">>, "journal">;
}> = Spec.make().addAt("journal", GroupSpec.makeAt("journal").addGroupAt("audit", journal_audit));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.journal;
