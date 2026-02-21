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

export async function requireJobSecret(req: HttpRequest, ctx: InvocationContext): Promise<{ ok: true } | { ok: false; resp: HttpResponseInit }> {
  const expected = process.env.JOB_SECRET;
  const got = req.headers.get("x-job-secret") ?? "";

  if (!expected) {
    ctx.error("Job endpoint misconfigured: missing JOB_SECRET env var");
    return { ok: false, resp: json(500, { error: "Internal Server Error" }) };
  }

  if (!got) {
    return { ok: false, resp: json(403, { error: "Forbidden" }) };
  }

  // Constant-time comparison.
  // If lengths differ, treat as forbidden (do not attempt timingSafeEqual).
  const a = Buffer.from(got, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return { ok: false, resp: json(403, { error: "Forbidden" }) };
  }

  const { timingSafeEqual } = await import("node:crypto");
  if (!timingSafeEqual(a, b)) {
    return { ok: false, resp: json(403, { error: "Forbidden" }) };
  }

  return { ok: true };
}
