import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { setupRoutes } from './routes/index.ts';

export function createServer(): OpenAPIHono {
  const app = new OpenAPIHono();

  // Setup routes
  setupRoutes(app);

  // Setup OpenAPI documentation
  app.doc31("/doc", {
    openapi: "3.1.0",
    info: {
      title: "Data Hub API",
      version: "1.0.0",
      description: "GitHub proxy endpoints backed by the GitHub CLI.",
    },
  });

  // Setup Swagger UI
  app.get(
    "/docs",
    swaggerUI({
      url: "/doc",
      version: "latest",
    }),
  );

  return app;
}

export function startServer(port: number = 8000): void {
  const app = createServer();
  console.log(`🚀 Server starting on http://localhost:${port}`);
  Deno.serve(app.fetch);
}

// Export the app for testing
export const app = createServer();