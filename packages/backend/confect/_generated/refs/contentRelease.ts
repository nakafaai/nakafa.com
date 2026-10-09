import { GroupSpec, Refs, Spec } from "@confect/core";
import contentRelease_article from "../../contentRelease/article.spec";
import contentRelease_material from "../../contentRelease/material.spec";
import contentRelease_ownership from "../../contentRelease/ownership.spec";
import contentRelease_page from "../../contentRelease/page.spec";
import contentRelease_program from "../../contentRelease/program.spec";
import contentRelease_quran from "../../contentRelease/quran.spec";
import contentRelease_reference from "../../contentRelease/reference.spec";
import contentRelease_runtime_active from "../../contentRelease/runtime/active.spec";
import contentRelease_tryout from "../../contentRelease/tryout.spec";

const spec: Spec.Spec<{
  readonly contentRelease: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "contentRelease", never, GroupSpec.NamedAt<typeof contentRelease_article, "article"> | GroupSpec.NamedAt<typeof contentRelease_material, "material"> | GroupSpec.NamedAt<typeof contentRelease_ownership, "ownership"> | GroupSpec.NamedAt<typeof contentRelease_page, "page"> | GroupSpec.NamedAt<typeof contentRelease_program, "program"> | GroupSpec.NamedAt<typeof contentRelease_quran, "quran"> | GroupSpec.NamedAt<typeof contentRelease_reference, "reference"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "runtime", never, GroupSpec.NamedAt<typeof contentRelease_runtime_active, "active">>, "runtime"> | GroupSpec.NamedAt<typeof contentRelease_tryout, "tryout">>, "contentRelease">;
}> = Spec.make().addAt("contentRelease", GroupSpec.makeAt("contentRelease").addGroupAt("article", contentRelease_article).addGroupAt("material", contentRelease_material).addGroupAt("ownership", contentRelease_ownership).addGroupAt("page", contentRelease_page).addGroupAt("program", contentRelease_program).addGroupAt("quran", contentRelease_quran).addGroupAt("reference", contentRelease_reference).addGroupAt("runtime", GroupSpec.makeAt("runtime").addGroupAt("active", contentRelease_runtime_active)).addGroupAt("tryout", contentRelease_tryout));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.contentRelease;
