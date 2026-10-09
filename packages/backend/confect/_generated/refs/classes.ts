import { GroupSpec, Refs, Spec } from "@confect/core";
import classes_forums_mutations_forums from "../../classes/forums/mutations/forums.spec";
import classes_forums_mutations_posts from "../../classes/forums/mutations/posts.spec";
import classes_forums_mutations_reactions from "../../classes/forums/mutations/reactions.spec";
import classes_forums_mutations_readState from "../../classes/forums/mutations/readState.spec";
import classes_forums_mutations_uploads from "../../classes/forums/mutations/uploads.spec";
import classes_forums_queries_forums from "../../classes/forums/queries/forums.spec";
import classes_forums_queries_pages from "../../classes/forums/queries/pages.spec";
import classes_materials_mutations from "../../classes/materials/mutations.spec";
import classes_materials_queries from "../../classes/materials/queries.spec";
import classes_mutations from "../../classes/mutations.spec";
import classes_queries from "../../classes/queries.spec";
import classes_roster from "../../classes/roster.spec";

const spec: Spec.Spec<{
  readonly classes: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "classes", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "forums", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "mutations", never, GroupSpec.NamedAt<typeof classes_forums_mutations_forums, "forums"> | GroupSpec.NamedAt<typeof classes_forums_mutations_posts, "posts"> | GroupSpec.NamedAt<typeof classes_forums_mutations_reactions, "reactions"> | GroupSpec.NamedAt<typeof classes_forums_mutations_readState, "readState"> | GroupSpec.NamedAt<typeof classes_forums_mutations_uploads, "uploads">>, "mutations"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "queries", never, GroupSpec.NamedAt<typeof classes_forums_queries_forums, "forums"> | GroupSpec.NamedAt<typeof classes_forums_queries_pages, "pages">>, "queries">>, "forums"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "materials", never, GroupSpec.NamedAt<typeof classes_materials_mutations, "mutations"> | GroupSpec.NamedAt<typeof classes_materials_queries, "queries">>, "materials"> | GroupSpec.NamedAt<typeof classes_mutations, "mutations"> | GroupSpec.NamedAt<typeof classes_queries, "queries"> | GroupSpec.NamedAt<typeof classes_roster, "roster">>, "classes">;
}> = Spec.make().addAt("classes", GroupSpec.makeAt("classes").addGroupAt("forums", GroupSpec.makeAt("forums").addGroupAt("mutations", GroupSpec.makeAt("mutations").addGroupAt("forums", classes_forums_mutations_forums).addGroupAt("posts", classes_forums_mutations_posts).addGroupAt("reactions", classes_forums_mutations_reactions).addGroupAt("readState", classes_forums_mutations_readState).addGroupAt("uploads", classes_forums_mutations_uploads)).addGroupAt("queries", GroupSpec.makeAt("queries").addGroupAt("forums", classes_forums_queries_forums).addGroupAt("pages", classes_forums_queries_pages))).addGroupAt("materials", GroupSpec.makeAt("materials").addGroupAt("mutations", classes_materials_mutations).addGroupAt("queries", classes_materials_queries)).addGroupAt("mutations", classes_mutations).addGroupAt("queries", classes_queries).addGroupAt("roster", classes_roster));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.classes;
