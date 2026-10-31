import { GroupSpec, Refs, Spec } from "@confect/core";
import records_draw from "../../records/draw.spec";
import records_letters from "../../records/letters.spec";
import records_prints from "../../records/prints.spec";
import records_seed from "../../records/seed.spec";

const spec: Spec.Spec<{
  readonly records: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_draw, "draw"> | GroupSpec.NamedAt<typeof records_letters, "letters"> | GroupSpec.NamedAt<typeof records_prints, "prints"> | GroupSpec.NamedAt<typeof records_seed, "seed">>, "records">;
}> = Spec.fromGroups({ ["records"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["draw"]: records_draw, ["letters"]: records_letters, ["prints"]: records_prints, ["seed"]: records_seed }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.records;
