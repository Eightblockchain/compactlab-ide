/**
 * Report browser-side funnel stages (deploy_ok, call_ok) to POST /v1/events.
 * Fire-and-forget: telemetry must never block or fail a Deploy or Call.
 * Only public identifiers go in meta — never witness values or arguments.
 */

export type ClientFunnelEvent = "deploy_ok" | "call_ok";

export type ClientFunnelMeta = {
  projectId?: string;
  template?: string;
  contractAddress?: string;
  circuit?: string;
  feeMode?: "sponsored" | "self";
};

export function reportFunnelEvent(kind: ClientFunnelEvent, meta: ClientFunnelMeta = {}): void {
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => typeof v === "string" && v.length > 0 && v.length <= 128),
  );
  void import("@/lib/api")
    .then(({ apiFetch }) =>
      apiFetch("/v1/events", { method: "POST", json: { kind, meta: clean }, keepalive: true }),
    )
    .catch(() => {
      /* telemetry is best-effort */
    });
}
