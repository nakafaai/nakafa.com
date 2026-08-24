import { proxyMcpRequest } from "@/lib/agent-origin";

// The Vercel project is edge-only and does not build this Next.js adapter.
// These exports preserve the documented localhost command only.
export const GET = proxyMcpRequest;
export const HEAD = proxyMcpRequest;
export const POST = proxyMcpRequest;
export const PUT = proxyMcpRequest;
export const PATCH = proxyMcpRequest;
export const DELETE = proxyMcpRequest;
export const OPTIONS = proxyMcpRequest;
