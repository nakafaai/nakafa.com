import { GroupSpec, Refs, Spec } from "@confect/core";
import chats_mutations from "../../chats/mutations.spec";
import chats_queries from "../../chats/queries.spec";

const spec: Spec.Spec<{
  readonly chats: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "chats", never, GroupSpec.NamedAt<typeof chats_mutations, "mutations"> | GroupSpec.NamedAt<typeof chats_queries, "queries">>, "chats">;
}> = Spec.make().addAt("chats", GroupSpec.makeAt("chats").addGroupAt("mutations", chats_mutations).addGroupAt("queries", chats_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.chats;
