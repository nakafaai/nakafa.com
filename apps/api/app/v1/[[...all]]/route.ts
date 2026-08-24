import { proxyPublicApiRequest } from "@/lib/agent-origin";

// Vercel routes production traffic directly to Convex before this filesystem
// adapter. These exports preserve the documented local Next.js command only.
export const GET = proxyPublicApiRequest;
export const HEAD = proxyPublicApiRequest;
export const POST = proxyPublicApiRequest;
export const PUT = proxyPublicApiRequest;
export const PATCH = proxyPublicApiRequest;
export const DELETE = proxyPublicApiRequest;
export const OPTIONS = proxyPublicApiRequest;
