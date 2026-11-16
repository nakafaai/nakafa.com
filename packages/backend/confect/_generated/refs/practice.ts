import { GroupSpec, Refs, Spec } from "@confect/core";
import practice_sessions from "../../practice/sessions.spec";

const spec: Spec.Spec<{
  readonly practice: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "practice", never, GroupSpec.NamedAt<typeof practice_sessions, "sessions">>, "practice">;
}> = Spec.fromGroups({ ["practice"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["sessions"]: practice_sessions }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.practice;
