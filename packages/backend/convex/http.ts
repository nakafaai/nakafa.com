import "./polyfills";
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { registerPolarRoutes } from "./routes/polar";

const http = httpRouter();

// Register auth routes
authComponent.registerRoutes(http, createAuth);

// Register Polar webhook routes
registerPolarRoutes(http);

export default http;
