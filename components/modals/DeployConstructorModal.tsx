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
import { WitnessInputRow } from "@/components/panels/compact-value-inputs";
import { validateWitnessValues, type WitnessSpec } from "@/lib/playground-witnesses";

export type DeploySetupResult = {
  constructorValues: Record<string, string>;
  witnessValues: Record<string, string>;
};

type Props = {
  open: boolean;
  /** Compact constructor args (may be empty). */
  constructorParams: CompactParamSpec[];
  initialConstructorValues: Record<string, string>;
  /**
   * Private witnesses required before Deploy (constructor reads them).
   * Empty when constructor does not call witnesses.
   */
  witnessParams: WitnessSpec[];
  initialWitnessValues: Record<string, string>;
  /** Names the constructor actually references (for emphasis). */
  constructorWitnessNames?: string[];
  typeEnv?: CompactTypeEnv;
  onCancel: () => void;
  onConfirm: (result: DeploySetupResult) => void;
};

/**
 * Collect everything Deploy needs before opening the progress modal:
 * constructor arguments and/or private witnesses the constructor will call.
 */
export function DeployConstructorModal({
  open,
  constructorParams,
  initialConstructorValues,
  witnessParams,
  initialWitnessValues,
  constructorWitnessNames = [],
  typeEnv,
  onCancel,
  onConfirm,
}: Props) {
  const [ctorValues, setCtorValues] = useState(initialConstructorValues);
  const [wValues, setWValues] = useState(initialWitnessValues);

  useEffect(() => {
    if (!open) return;
    setCtorValues(initialConstructorValues);
    setWValues(initialWitnessValues);
  }, [open, initialConstructorValues, initialWitnessValues]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const ctorErr = useMemo(
    () =>
      constructorParams.length > 0
        ? validateCompactParams(constructorParams, ctorValues, "Constructor parameter", typeEnv)
        : null,
    [constructorParams, ctorValues, typeEnv],
  );

  const witnessErr = useMemo(
    () =>
      witnessParams.length > 0 ? validateWitnessValues(witnessParams, wValues) : null,
    [witnessParams, wValues],
  );

  const err = ctorErr ?? witnessErr;
  const usedSet = useMemo(
    () => new Set(constructorWitnessNames),
    [constructorWitnessNames],
  );

  if (!open) return null;

  const hasCtor = constructorParams.length > 0;
  const hasWitnesses = witnessParams.length > 0;
  const title =
    hasCtor && hasWitnesses
      ? "Before you Deploy"
      : hasWitnesses
        ? "Set private witnesses"
        : "Set constructor values";

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
        aria-labelledby="deploy-setup-title"
        className="relative w-full max-w-[540px] rounded-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        style={{
          background: "#121215",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px -16px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-2xs uppercase tracking-[0.14em] text-accent/80 font-medium">
            Deploy setup
          </p>
          <h2 id="deploy-setup-title" className="text-lg font-semibold text-text-primary tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {hasWitnesses && hasCtor
              ? "Fill constructor arguments and the private witnesses this constructor calls. Other witnesses are not needed until Call."
              : hasWitnesses
                ? "This constructor calls the witnesses below. Other declared witnesses are not required at Deploy."
                : "These run once when the contract is created on Preprod. You cannot change them after Deploy."}
          </p>
        </div>

        {hasCtor && (
          <section className="space-y-3">
            <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Constructor arguments
            </h3>
            <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
              {constructorParams.map((p, idx) => {
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
                          ctorValues[p.name] === "false"
                            ? "false"
                            : ctorValues[p.name] === "true"
                              ? "true"
                              : ""
                        }
                        onChange={(e) =>
                          setCtorValues((v) => ({ ...v, [p.name]: e.target.value }))
                        }
                        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-text-primary"
                      >
                        <option value="">Select…</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : composite ? (
                      <textarea
                        value={ctorValues[p.name] ?? ""}
                        onChange={(e) =>
                          setCtorValues((v) => ({ ...v, [p.name]: e.target.value }))
                        }
                        rows={5}
                        spellCheck={false}
                        placeholder={exampleJsonForType(p.type, p.typeSchema, typeEnv)}
                        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim"
                      />
                    ) : (
                      <input
                        type="text"
                        value={ctorValues[p.name] ?? ""}
                        onChange={(e) =>
                          setCtorValues((v) => ({ ...v, [p.name]: e.target.value }))
                        }
                        spellCheck={false}
                        placeholder={placeholderForCompactType(p.type, p.typeSchema, typeEnv)}
                        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim"
                        autoFocus={idx === 0 && !hasWitnesses}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasWitnesses && (
          <section className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Private witnesses
              </h3>
              <p className="text-2xs text-text-muted leading-relaxed">
                Only witnesses the <span className="text-text-secondary">constructor</span> calls
                are required here. Other witnesses can wait until you Call a circuit that uses them.
                Keep these secrets — you will need the same values later.
              </p>
            </div>
            <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
              {witnessParams.map((w) => (
                <div key={w.name} className="space-y-1">
                  {usedSet.has(w.name) && (
                    <p className="text-[10px] uppercase tracking-wide text-accent/70">
                      Used at Deploy
                    </p>
                  )}
                  <WitnessInputRow
                    name={w.name}
                    type={w.type}
                    value={wValues[w.name] ?? ""}
                    onChange={(val) => setWValues((v) => ({ ...v, [w.name]: val }))}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {err && <p className="text-xs text-warning leading-relaxed">{err}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="md"
            disabled={!!err}
            onClick={() =>
              onConfirm({
                constructorValues: ctorValues,
                witnessValues: wValues,
              })
            }
          >
            Continue to Deploy
          </Button>
        </div>
      </div>
    </div>
  );
}

export function promptConstructorEnvFromSource(code: string): CompactTypeEnv {
  return typeEnvFromCompactSource(code);
}
