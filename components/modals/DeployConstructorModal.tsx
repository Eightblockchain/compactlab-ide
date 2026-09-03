"use client";

import { Button } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import {
  exampleJsonForType,
  isCompositeCompactKind,
  compactValueKind,
  placeholderForCompactType,
  typeEnvFromCompactSource,
  validateCompactParams,
  type CompactParamSpec,
  type CompactTypeEnv,
} from "@/lib/compact-values";

type Props = {
  open: boolean;
  params: CompactParamSpec[];
  initialValues: Record<string, string>;
  typeEnv?: CompactTypeEnv;
  onCancel: () => void;
  onConfirm: (values: Record<string, string>) => void;
};

/**
 * Collect Compact constructor arguments before Deploy submits a transaction.
 * Matches generated `initialState(context, …args)` extra parameters.
 */
export function DeployConstructorModal({
  open,
  params,
  initialValues,
  typeEnv,
  onCancel,
  onConfirm,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const err = useMemo(
    () => validateCompactParams(params, values, "Constructor parameter", typeEnv),
    [params, values, typeEnv],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-ctor-title"
        className="relative w-full max-w-[520px] rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        style={{
          background: "#131313",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <h2 id="deploy-ctor-title" className="text-base font-semibold text-text-primary">
            Constructor arguments
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This contract’s constructor runs once at Deploy. Provide the same arguments Compact
            declares — they become <span className="font-mono text-2xs">deployContract.args</span>.
          </p>
        </div>

        <div className="space-y-3">
          {params.map((p) => {
            const kind = compactValueKind(p.type, p.typeSchema, typeEnv);
            const composite = isCompositeCompactKind(kind);
            return (
              <div key={p.name} className="space-y-1">
                <label className="text-xs font-mono text-text-primary">
                  {p.name}
                  <span className="ml-1.5 text-2xs text-accent/80">{p.type}</span>
                </label>
                {kind === "boolean" ? (
                  <select
                    value={
                      values[p.name] === "false"
                        ? "false"
                        : values[p.name] === "true"
                          ? "true"
                          : ""
                    }
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary"
                  >
                    <option value="">Select…</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : composite ? (
                  <textarea
                    value={values[p.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    rows={5}
                    spellCheck={false}
                    placeholder={exampleJsonForType(p.type, p.typeSchema, typeEnv)}
                    className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[p.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    spellCheck={false}
                    placeholder={placeholderForCompactType(p.type, p.typeSchema, typeEnv)}
                    className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim"
                    autoFocus={p.name === params[0]?.name}
                  />
                )}
              </div>
            );
          })}
        </div>

        {err && <p className="text-xs text-warning leading-relaxed">{err}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="md"
            disabled={!!err}
            onClick={() => onConfirm(values)}
          >
            Continue Deploy
          </Button>
        </div>
      </div>
    </div>
  );
}

export function promptConstructorEnvFromSource(code: string): CompactTypeEnv {
  return typeEnvFromCompactSource(code);
}
