import { Router } from "express";
import { openApiSpec } from "../core/openapi-spec.js";

export const docsRouter = Router();

docsRouter.get("/api/v1/openapi.json", (_req, res) => {
  res.status(200).json(openApiSpec);
});

docsRouter.get("/api/v1/docs", (_req, res) => {
  res.status(200).type("html").send(`<!doctype html>
<html>
  <head>
    <title>Radio Core API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        dom_id: "#swagger-ui",
      });
    </script>
  </body>
</html>`);
});
