import { GroupSpec, Refs, Spec } from "@confect/core";
import tryouts_mutations_access from "../../tryouts/mutations/access.spec";
import tryouts_mutations_attempts from "../../tryouts/mutations/attempts.spec";
import tryouts_mutations_responses from "../../tryouts/mutations/responses.spec";
import tryouts_mutations_sections from "../../tryouts/mutations/sections.spec";
import tryouts_queries_access from "../../tryouts/queries/access.spec";
import tryouts_queries_attempt from "../../tryouts/queries/attempt.spec";
import tryouts_queries_attemptPage from "../../tryouts/queries/attemptPage.spec";
import tryouts_queries_catalog from "../../tryouts/queries/catalog.spec";
import tryouts_queries_content from "../../tryouts/queries/content.spec";
import tryouts_queries_history from "../../tryouts/queries/history.spec";
import tryouts_queries_runtime from "../../tryouts/queries/runtime.spec";
import tryouts_queries_sets from "../../tryouts/queries/sets.spec";

const spec: Spec.Spec<{
  readonly tryouts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "tryouts", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof tryouts_mutations_access, "access"> | GroupSpec.NamedAt<typeof tryouts_mutations_attempts, "attempts"> | GroupSpec.NamedAt<typeof tryouts_mutations_responses, "responses"> | GroupSpec.NamedAt<typeof tryouts_mutations_sections, "sections">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<typeof tryouts_queries_access, "access"> | GroupSpec.NamedAt<typeof tryouts_queries_attempt, "attempt"> | GroupSpec.NamedAt<typeof tryouts_queries_attemptPage, "attemptPage"> | GroupSpec.NamedAt<typeof tryouts_queries_catalog, "catalog"> | GroupSpec.NamedAt<typeof tryouts_queries_content, "content"> | GroupSpec.NamedAt<typeof tryouts_queries_history, "history"> | GroupSpec.NamedAt<typeof tryouts_queries_runtime, "runtime"> | GroupSpec.NamedAt<typeof tryouts_queries_sets, "sets">>, "queries">>, "tryouts">;
}> = Spec.make().addAt("tryouts", GroupSpec.makeAt("tryouts").addGroupAt("mutations", GroupSpec.makeAt("mutations").addGroupAt("access", tryouts_mutations_access).addGroupAt("attempts", tryouts_mutations_attempts).addGroupAt("responses", tryouts_mutations_responses).addGroupAt("sections", tryouts_mutations_sections)).addGroupAt("queries", GroupSpec.makeAt("queries").addGroupAt("access", tryouts_queries_access).addGroupAt("attempt", tryouts_queries_attempt).addGroupAt("attemptPage", tryouts_queries_attemptPage).addGroupAt("catalog", tryouts_queries_catalog).addGroupAt("content", tryouts_queries_content).addGroupAt("history", tryouts_queries_history).addGroupAt("runtime", tryouts_queries_runtime).addGroupAt("sets", tryouts_queries_sets)));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.tryouts;
