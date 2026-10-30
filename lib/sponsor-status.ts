import { apiFetch } from "@/lib/api";
import type { SponsorStatusResponse } from "@/lib/fee-mode";
import { useIDEStore } from "@/store/ide";

function unavailable(reason: string): SponsorStatusResponse {
  return {
    enabled: false,
    healthy: false,
    configured: false,
    dustBalance: null,
    dustCap: null,
    reason,
  };
}

/** Fetch /v1/sponsor/status; never throws (errors become an unavailable status). */
export async function fetchSponsorStatus(): Promise<SponsorStatusResponse> {
  try {
    const res = await apiFetch("/v1/sponsor/status");
    const text = await res.text();
    let body: (SponsorStatusResponse & { error?: string }) | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON: handled below */
    }
    if (!res.ok || !body) {
      return unavailable(body?.error || `Sponsor status ${res.status}`);
    }
    return body;
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : String(err));
  }
}

/** Refresh the store's sponsor status (e.g. the "N left today" badge after a tx). */
export async function refreshSponsorStatus(): Promise<SponsorStatusResponse> {
  const status = await fetchSponsorStatus();
  useIDEStore.getState().setSponsorStatus(status);
  return status;
}
