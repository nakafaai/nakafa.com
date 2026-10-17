import { GroupSpec, Refs, Spec } from "@confect/core";
import chats_mutations from "../../chats/mutations.spec";
import chats_queries from "../../chats/queries.spec";

const spec: Spec.Spec<{
  readonly chats: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "chats", never, GroupSpec.NamedAt<typeof chats_mutations, "mutations"> | GroupSpec.NamedAt<typeof chats_queries, "queries">>, "chats">;
}> = Spec.fromGroups({ ["chats"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: chats_mutations, ["queries"]: chats_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.chats;
