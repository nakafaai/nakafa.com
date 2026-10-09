import { createAuthProxy } from "@/lib/auth/proxy";
import { handler } from "@/lib/auth/server";

export const { GET, POST } = createAuthProxy(handler);
