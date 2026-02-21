import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import { json } from "./jobsShared";

export async function health(_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  return json(200, { status: "ok" });
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health
});
