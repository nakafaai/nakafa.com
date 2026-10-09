import { GroupSpec, Refs, Spec } from "@confect/core";
import nina_conversation from "../../nina/conversation.spec";
import nina_lifecycle from "../../nina/lifecycle.spec";
import nina_memory from "../../nina/memory.spec";
import nina_messages from "../../nina/messages.spec";
import nina_turns from "../../nina/turns.spec";
import nina_uploads from "../../nina/uploads.spec";

const spec: Spec.Spec<{
  readonly nina: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "nina", never, GroupSpec.NamedAt<typeof nina_conversation, "conversation"> | GroupSpec.NamedAt<typeof nina_lifecycle, "lifecycle"> | GroupSpec.NamedAt<typeof nina_memory, "memory"> | GroupSpec.NamedAt<typeof nina_messages, "messages"> | GroupSpec.NamedAt<typeof nina_turns, "turns"> | GroupSpec.NamedAt<typeof nina_uploads, "uploads">>, "nina">;
}> = Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("conversation", nina_conversation).addGroupAt("lifecycle", nina_lifecycle).addGroupAt("memory", nina_memory).addGroupAt("messages", nina_messages).addGroupAt("turns", nina_turns).addGroupAt("uploads", nina_uploads));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.nina;
