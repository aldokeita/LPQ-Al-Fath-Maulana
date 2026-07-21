import { getCorsHeaders } from "./cors.ts";

type JsonValue = Record<string, unknown> | unknown[];

export function ok(req: Request, data: JsonValue = {}, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "content-type": "application/json", ...getCorsHeaders(req) },
  });
}

export function fail(req: Request, code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json", ...getCorsHeaders(req) },
  });
}

export function methodNotAllowed(req: Request): Response {
  return fail(req, "METHOD_NOT_ALLOWED", "Metode request tidak didukung.", 405);
}
