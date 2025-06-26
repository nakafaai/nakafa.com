import { Elysia } from "elysia";

export const healthRoute = new Elysia({ prefix: "/health" }).get(
  "/",
  () => {
    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        formatted: uptimeFormatted,
      },
      server: {
        name: "Nakafa API Server",
        version: "1.0.0",
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: "MB",
      },
    };
  },
  {
    detail: {
      tags: ["Health"],
      summary: "Health check endpoint.",
      description:
        "Returns server health status, uptime, and system information.",
    },
  }
);
