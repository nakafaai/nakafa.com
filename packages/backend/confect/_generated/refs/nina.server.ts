import { GroupSpec, Refs, Spec } from "@confect/core";
import nina_brief from "../../nina/brief.spec";
import nina_documents from "../../nina/documents.spec";
import nina_focus from "../../nina/focus.spec";
import nina_judgment from "../../nina/judgment.spec";
import nina_lifecycle from "../../nina/lifecycle.spec";
import nina_memory from "../../nina/memory.spec";
import nina_phase from "../../nina/phase.spec";
import nina_portrait from "../../nina/portrait.spec";
import nina_portrait_build from "../../nina/portrait/build.spec";
import nina_presentation from "../../nina/presentation.spec";
import nina_response from "../../nina/response.spec";
import nina_sealed from "../../nina/sealed.spec";
import nina_summaries from "../../nina/summaries.spec";
import nina_uploads from "../../nina/uploads.spec";
import nina_usage from "../../nina/usage.spec";
import nina_waits from "../../nina/waits.spec";

const spec: Spec.Spec<{
  readonly nina: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "nina", never, GroupSpec.NamedAt<typeof nina_brief, "brief"> | GroupSpec.NamedAt<typeof nina_documents, "documents"> | GroupSpec.NamedAt<typeof nina_focus, "focus"> | GroupSpec.NamedAt<typeof nina_judgment, "judgment"> | GroupSpec.NamedAt<typeof nina_lifecycle, "lifecycle"> | GroupSpec.NamedAt<typeof nina_memory, "memory"> | GroupSpec.NamedAt<typeof nina_phase, "phase"> | GroupSpec.NamedAt<GroupSpec.AddGroups<typeof nina_portrait, GroupSpec.NamedAt<typeof nina_portrait_build, "build">>, "portrait"> | GroupSpec.NamedAt<typeof nina_presentation, "presentation"> | GroupSpec.NamedAt<typeof nina_response, "response"> | GroupSpec.NamedAt<typeof nina_sealed, "sealed"> | GroupSpec.NamedAt<typeof nina_summaries, "summaries"> | GroupSpec.NamedAt<typeof nina_uploads, "uploads"> | GroupSpec.NamedAt<typeof nina_usage, "usage"> | GroupSpec.NamedAt<typeof nina_waits, "waits">>, "nina">;
}> = Spec.fromGroups({ ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["brief"]: nina_brief, ["documents"]: nina_documents, ["focus"]: nina_focus, ["judgment"]: nina_judgment, ["lifecycle"]: nina_lifecycle, ["memory"]: nina_memory, ["phase"]: nina_phase, ["portrait"]: GroupSpec.addGroupsAt(nina_portrait, { ["build"]: nina_portrait_build }), ["presentation"]: nina_presentation, ["response"]: nina_response, ["sealed"]: nina_sealed, ["summaries"]: nina_summaries, ["uploads"]: nina_uploads, ["usage"]: nina_usage, ["waits"]: nina_waits }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.nina;
