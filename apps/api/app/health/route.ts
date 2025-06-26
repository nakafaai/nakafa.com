export function GET() {
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

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
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
