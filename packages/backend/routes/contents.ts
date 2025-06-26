import { getContents } from "@repo/contents/_lib/utils";
import { Elysia, t } from "elysia";

export const contentsRoute = new Elysia({ prefix: "/contents" }).get(
  "/*",
  async ({ params }) => {
    const wildcard = params["*"];
    const slug = typeof wildcard === "string" ? wildcard.split("/") : [];

    let locale = "en";
    let basePath = "";

    if (slug.length >= 1) {
      locale = slug[0] ?? "en";
      basePath = slug.slice(1).join("/");
    }

    const content = await getContents({
      locale,
      basePath,
    });

    return content;
  },
  {
    detail: {
      tags: ["Contents"],
      summary: "Get educational content.",
      description: "Retrieve educational content by locale and path.",
    },
    params: t.Object({
      "*": t.Optional(t.String({ description: "Content path with locale." })),
    }),
  }
);
