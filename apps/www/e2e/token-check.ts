import { contentRuntimeKeys } from "@repo/next-config/keys";
import { createHash } from "node:crypto";
const k = contentRuntimeKeys().CONTENT_RUNTIME_TOKEN;
console.log("token len", k.length, "sha", createHash("sha256").update(k).digest("hex").slice(0, 12));
