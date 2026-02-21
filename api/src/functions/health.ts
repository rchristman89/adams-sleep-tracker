import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

export async function health(_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  ctx.info("Health check ping");
  return {
    status: 200,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ status: "ok" })
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health
});
