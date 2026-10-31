import { GroupSpec, Refs, Spec } from "@confect/core";
import integrations_devices from "../../integrations/devices.spec";
import integrations_reads from "../../integrations/reads.spec";
import integrations_tokens from "../../integrations/tokens.spec";

const spec: Spec.Spec<{
  readonly integrations: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "integrations", never, GroupSpec.NamedAt<typeof integrations_devices, "devices"> | GroupSpec.NamedAt<typeof integrations_reads, "reads"> | GroupSpec.NamedAt<typeof integrations_tokens, "tokens">>, "integrations">;
}> = Spec.fromGroups({ ["integrations"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["devices"]: integrations_devices, ["reads"]: integrations_reads, ["tokens"]: integrations_tokens }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.integrations;
