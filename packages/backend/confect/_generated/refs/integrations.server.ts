import { GroupSpec, Refs, Spec } from "@confect/core";
import integrations_devices from "../../integrations/devices.spec";
import integrations_hooks from "../../integrations/hooks.spec";
import integrations_reads from "../../integrations/reads.spec";
import integrations_tokens from "../../integrations/tokens.spec";
import integrations_writes from "../../integrations/writes.spec";

const spec: Spec.Spec<{
  readonly integrations: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "integrations", never, GroupSpec.NamedAt<typeof integrations_devices, "devices"> | GroupSpec.NamedAt<typeof integrations_hooks, "hooks"> | GroupSpec.NamedAt<typeof integrations_reads, "reads"> | GroupSpec.NamedAt<typeof integrations_tokens, "tokens"> | GroupSpec.NamedAt<typeof integrations_writes, "writes">>, "integrations">;
}> = Spec.fromGroups({ ["integrations"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["devices"]: integrations_devices, ["hooks"]: integrations_hooks, ["reads"]: integrations_reads, ["tokens"]: integrations_tokens, ["writes"]: integrations_writes }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.integrations;
