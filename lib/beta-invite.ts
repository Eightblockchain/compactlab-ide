/**
 * Beta invite links (/join/<code>, roadmap S05).
 *
 * The join page remembers the code in this browser, so it survives every way of
 * signing in (email signup, login, Google/GitHub redirect). The playground claims
 * it once the user is signed in, then opens the Hello, Midnight! project.
 */

import { createBrowserApi, type BetaMembership } from "@/lib/api";
import { useIDEStore } from "@/store/ide";

const PENDING_KEY = "compactlab_pending_invite";
/** The playground shows the beta welcome once per joined invite. */
const WELCOMED_KEY = "compactlab_beta_welcomed";

export function rememberInvite(code: string) {
  try {
    localStorage.setItem(PENDING_KEY, code);
  } catch {
    /* storage blocked: the join page still offers the Join button after sign-in */
  }
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function forgetInvite() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** Join the remembered invite, if any. Returns the membership, or null. */
export async function claimPendingInvite(): Promise<BetaMembership | null> {
  const code = pendingInvite();
  if (!code) return null;
  try {
    const { membership } = await createBrowserApi().joinBeta(code);
    forgetInvite();
    return membership;
  } catch {
    // Unknown or closed link: don't retry on every load.
    forgetInvite();
    return null;
  }
}

export function shouldWelcome(membership: BetaMembership): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) !== membership.inviteCode;
  } catch {
    return true;
  }
}

export function markWelcomed(membership: BetaMembership) {
  try {
    localStorage.setItem(WELCOMED_KEY, membership.inviteCode);
  } catch {
    /* ignore */
  }
}

export const HELLO_PROJECT_NAME = "Hello, Midnight!";

/** Open the user's Hello, Midnight! project, creating it if they deleted it. */
export function openHelloMidnight() {
  const { projects, loadProject, createProject } = useIDEStore.getState();
  const hello =
    projects.find((p) => p.template === "hello-world" && p.name === HELLO_PROJECT_NAME) ??
    projects.find((p) => p.template === "hello-world");
  if (hello) loadProject(hello.id);
  else createProject(HELLO_PROJECT_NAME, "hello-world", "Store a public string on-chain. Deploy it with sponsored fees.");
}
