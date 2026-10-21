"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, createBrowserApi, setToken } from "@/lib/api";
import { SPONSORED_FEES_ENABLED, feeModeLabel, type FeeMode } from "@/lib/fee-mode";
import { useUserSettings } from "@/lib/user-settings";
import { useIDEStore } from "@/store/ide";
import { syncProjectNow } from "@/lib/project-sync";
import { clearWalletRestorePreference } from "@/lib/wallet-restore";
import { cn } from "@/lib/utils";
import { NETWORKS, type PlaygroundNetwork } from "@/lib/network";
import {
  BLOCKFROST_SIGNUP_URL,
  setOwnBlockfrostKey,
  testBlockfrostKey,
  useOwnBlockfrostKey,
} from "@/lib/own-blockfrost-key";

const NETWORK_HELP: Record<PlaygroundNetwork, string> = {
  preprod:
    "Default. Matches the 1AM Preprod faucet and sponsored fees. Uses CompactLab's shared indexer allowance unless you add your own Blockfrost key below.",
  preview:
    "Free public indexer with no shared allowance. Use the Preview faucet; sponsored fees are not available. Contracts deployed on Preprod are not visible here.",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/[0.02]"
    >
      <span
        className={cn(
          "relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-text-primary leading-snug">{label}</span>
        <span className="mt-1 block text-2xs text-text-muted leading-relaxed">{description}</span>
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="px-0.5 text-2xs font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </h3>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] divide-y divide-white/[0.06]">
        {children}
      </div>
    </section>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-3.5 py-3.5", className)}>{children}</div>;
}

export function SettingsModal({ open, onClose }: Props) {
  const { user, refresh, logout } = useAuth();
  const {
    syncWitnessesToCloud,
    setSyncWitnessesToCloud,
    walletRestoreEnabled,
    setWalletRestoreEnabled,
    defaultFeeMode,
    setDefaultFeeMode,
    editorFontSize,
    setEditorFontSize,
    editorTabSize,
    setEditorTabSize,
    network,
    setNetwork,
  } = useUserSettings();
  const ownKey = useOwnBlockfrostKey();
  const [keyInput, setKeyInput] = useState("");
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const setFeeMode = useIDEStore((s) => s.setFeeMode);

  const [name, setName] = useState(user?.name ?? "");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setProfileMsg(null);
    setProfileErr(null);
    setPasswordMsg(null);
    setPasswordErr(null);
    setDeleteErr(null);
    setKeyInput("");
    setKeyMsg(null);
    setKeyErr(null);
    setCurrentPassword("");
    setNewPassword("");
    setDeletePassword("");
    setDeleteConfirm("");
    void refresh();
    // Reset form only when the modal opens (not when refresh updates user).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open-only
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Prefer server flag after refresh; undefined means "still loading" → password account UI.
  const hasPassword = user?.hasPassword !== false;

  async function saveOwnKey(e: FormEvent) {
    e.preventDefault();
    setKeyBusy(true);
    setKeyErr(null);
    setKeyMsg(null);
    const result = await testBlockfrostKey(keyInput);
    setKeyBusy(false);
    if (!result.ok) {
      setKeyErr(result.message);
      return;
    }
    setOwnBlockfrostKey(keyInput.trim());
    setKeyInput("");
    setKeyMsg(`Key works (Preprod block ${result.height.toLocaleString()}). Preprod traffic now goes from this browser to Blockfrost.`);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileErr(null);
    setProfileMsg(null);
    try {
      const api = createBrowserApi();
      await api.updateMe({ name: name.trim() || null });
      await refresh();
      setProfileMsg("Display name saved.");
    } catch (err) {
      setProfileErr(err instanceof ApiError ? err.message : "Could not save profile");
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordErr(null);
    setPasswordMsg(null);
    try {
      const api = createBrowserApi();
      const res = await api.changePassword({ currentPassword, newPassword });
      setToken(res.token);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg("Password updated. Other sessions were signed out.");
    } catch (err) {
      setPasswordErr(err instanceof ApiError ? err.message : "Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      const api = createBrowserApi();
      if (hasPassword) {
        await api.deleteAccount({ password: deletePassword });
      } else {
        await api.deleteAccount({ confirm: "DELETE" });
      }
      await logout();
      onClose();
    } catch (err) {
      setDeleteErr(err instanceof ApiError ? err.message : "Could not delete account");
    } finally {
      setDeleteBusy(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-white/[0.1] bg-black/35 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20";
  const selectClass =
    "rounded-lg border border-white/[0.1] bg-black/35 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent/40";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative flex w-full max-w-[520px] max-h-[min(90vh,760px)] flex-col overflow-hidden rounded-xl"
        style={{
          background: "#121215",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px -16px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <p className="text-2xs uppercase tracking-[0.14em] text-accent/80 font-medium">
              CompactLab
            </p>
            <h2 id="settings-title" className="text-lg font-semibold tracking-tight text-text-primary">
              Settings
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Network, privacy, wallet, editor, and account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <Section title="Network">
            <Row className="space-y-2.5">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Midnight network">
                {(Object.keys(NETWORKS) as PlaygroundNetwork[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={network === id}
                    onClick={() => setNetwork(id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      network === id
                        ? "border-accent/30 bg-accent/15 text-accent"
                        : "border-white/[0.1] text-text-secondary hover:bg-white/[0.04]",
                    )}
                  >
                    {NETWORKS[id].label}
                  </button>
                ))}
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">{NETWORK_HELP[network]}</p>
              <p className="text-2xs text-text-muted leading-relaxed">
                Switching disconnects 1AM. Set 1AM to the same network before you reconnect.
              </p>
            </Row>
            <Row>
              <form onSubmit={saveOwnKey} className="space-y-3">
                <div>
                  <p className="text-sm text-text-primary">Your own Blockfrost key (Preprod)</p>
                  <p className="mt-1 text-2xs text-text-muted leading-relaxed">
                    Optional. Skips CompactLab&apos;s shared daily allowance. Stored only in this browser and sent
                    only to Blockfrost, never to CompactLab. Create a free Midnight Preprod project at{" "}
                    <a
                      href={BLOCKFROST_SIGNUP_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-secondary underline decoration-white/20 underline-offset-2 hover:text-text-primary"
                    >
                      blockfrost.io
                    </a>
                    .
                  </p>
                </div>
                {ownKey ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-text-secondary">
                      {ownKey.slice(0, 12)}…{ownKey.slice(-4)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOwnBlockfrostKey(null);
                        setKeyMsg("Key removed. Preprod uses CompactLab's shared indexer again.");
                      }}
                    >
                      Remove key
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className={cn(fieldClass, "sm:flex-1 font-mono")}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="nightpreprod…"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={keyBusy}
                      disabled={!keyInput.trim()}
                      className="sm:flex-shrink-0"
                    >
                      Test and save
                    </Button>
                  </div>
                )}
                {keyErr && <p className="text-2xs text-error">{keyErr}</p>}
                {keyMsg && <p className="text-2xs text-success">{keyMsg}</p>}
              </form>
            </Row>
          </Section>

          <Section title="Preferences">
            <Row>
              <Toggle
                checked={syncWitnessesToCloud}
                onChange={(next) => {
                  setSyncWitnessesToCloud(next);
                  if (!next) {
                    for (const p of useIDEStore.getState().projects) {
                      syncProjectNow(p);
                    }
                  }
                }}
                label="Sync witness values to the cloud"
                description="Off keeps private witness inputs on this device only. Deploy and Call still work; other browsers will not see those values."
              />
            </Row>
            <Row>
              <Toggle
                checked={walletRestoreEnabled}
                onChange={(next) => {
                  setWalletRestoreEnabled(next);
                  if (!next) clearWalletRestorePreference();
                }}
                label="Remember 1AM connection"
                description="Reconnect automatically after refresh for up to 7 days (while 1AM still authorizes this site)."
              />
            </Row>
            {SPONSORED_FEES_ENABLED && NETWORKS[network].sponsorship && (
              <Row className="space-y-2.5">
                <p className="text-sm text-text-primary">Default fee mode</p>
                <div className="flex flex-wrap gap-2">
                  {(["self", "sponsored"] as FeeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setDefaultFeeMode(mode);
                        setFeeMode(mode);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                        defaultFeeMode === mode
                          ? "border-accent/30 bg-accent/15 text-accent"
                          : "border-white/[0.1] text-text-secondary hover:bg-white/[0.04]",
                      )}
                    >
                      {feeModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </Row>
            )}
            <Row className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text-primary">Font size</span>
                <select
                  className={selectClass}
                  value={editorFontSize}
                  onChange={(e) => setEditorFontSize(Number(e.target.value))}
                >
                  {[11, 12, 13, 14, 15, 16, 18].map((n) => (
                    <option key={n} value={n}>
                      {n}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text-primary">Tab size</span>
                <select
                  className={selectClass}
                  value={editorTabSize}
                  onChange={(e) => setEditorTabSize(Number(e.target.value))}
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                </select>
              </label>
            </Row>
          </Section>

          <Section title="Account">
            <Row>
              <form onSubmit={saveProfile} className="space-y-3">
                <div>
                  <p className="text-2xs uppercase tracking-[0.12em] text-text-muted">Signed in as</p>
                  <p className="mt-1 truncate text-sm text-text-primary">{user?.email ?? "…"}</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="settings-display-name" className="text-2xs text-text-muted">
                    Display name
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      id="settings-display-name"
                      className={cn(fieldClass, "sm:flex-1")}
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                    />
                    <Button type="submit" size="sm" loading={profileBusy} className="sm:flex-shrink-0">
                      Save name
                    </Button>
                  </div>
                </div>
                {profileErr && <p className="text-2xs text-error">{profileErr}</p>}
                {profileMsg && <p className="text-2xs text-success">{profileMsg}</p>}
              </form>
            </Row>

            <Row>
              {hasPassword ? (
                <form onSubmit={savePassword} className="space-y-3">
                  <div>
                    <p className="text-sm text-text-primary">Change password</p>
                    <p className="mt-1 text-2xs text-text-muted leading-relaxed">
                      Updates your password and signs out other sessions.
                    </p>
                  </div>
                  <input
                    className={fieldClass}
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <input
                    className={fieldClass}
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="New password (min 8)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  {passwordErr && <p className="text-2xs text-error">{passwordErr}</p>}
                  {passwordMsg && <p className="text-2xs text-success">{passwordMsg}</p>}
                  <Button type="submit" size="sm" loading={passwordBusy}>
                    Update password
                  </Button>
                </form>
              ) : (
                <p className="text-2xs text-text-muted leading-relaxed">
                  This account signs in with Google or GitHub, so there is no password to change.
                </p>
              )}
            </Row>

            <Row>
              <form onSubmit={deleteAccount} className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-error">Delete account</p>
                  <p className="mt-1 text-2xs text-text-muted leading-relaxed">
                    Permanently deletes your CompactLab account and cloud projects. This cannot be undone.
                  </p>
                </div>
                {hasPassword ? (
                  <input
                    className={fieldClass}
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Confirm with your password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                ) : (
                  <input
                    className={fieldClass}
                    required
                    placeholder='Type DELETE to confirm'
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                  />
                )}
                {deleteErr && <p className="text-2xs text-error">{deleteErr}</p>}
                <Button
                  type="submit"
                  size="sm"
                  variant="danger"
                  loading={deleteBusy}
                  disabled={!hasPassword && deleteConfirm !== "DELETE"}
                >
                  Delete my account
                </Button>
              </form>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
