const UP_TIME_SECONDS_PER_HOUR = 3600;
const UP_TIME_SECONDS_PER_MINUTE = 60;
const MEMORY_USAGE_FACTOR = 1024;

export function GET() {
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / UP_TIME_SECONDS_PER_HOUR)}h ${Math.floor((uptime % UP_TIME_SECONDS_PER_HOUR) / UP_TIME_SECONDS_PER_MINUTE)}m ${Math.floor(uptime % UP_TIME_SECONDS_PER_MINUTE)}s`;

  return new Response(
    JSON.stringify(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: Math.floor(uptime),
          formatted: uptimeFormatted,
        },
        server: {
          name: "Nakafa MCP Server",
          version: "1.0.0",
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        memory: {
          used: Math.round(
            process.memoryUsage().heapUsed /
              MEMORY_USAGE_FACTOR /
              MEMORY_USAGE_FACTOR,
          ),
          total: Math.round(
            process.memoryUsage().heapTotal /
              MEMORY_USAGE_FACTOR /
              MEMORY_USAGE_FACTOR,
          ),
          unit: "MB",
        },
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
