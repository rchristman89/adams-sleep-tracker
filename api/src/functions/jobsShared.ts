import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

export function requireJobSecret(req: HttpRequest, ctx: InvocationContext): { ok: true } | { ok: false; resp: HttpResponseInit } {
  const expected = process.env.JOB_SECRET;
  const got = req.headers.get("x-job-secret") ?? "";

  if (!expected) {
    ctx.error("Job endpoint misconfigured: missing JOB_SECRET env var");
    return { ok: false, resp: json(500, { error: "Internal Server Error" }) };
  }

  if (!got || got !== expected) {
    return { ok: false, resp: json(403, { error: "Forbidden" }) };
  }

  return { ok: true };
}
