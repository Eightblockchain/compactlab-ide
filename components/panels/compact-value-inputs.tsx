"use client";

import { Badge, Button } from "@/components/ui";
import {
  bytesLengthFromType,
  generateBytesHex,
} from "@/lib/playground-witnesses";
import {
  compactValueKind,
  exampleJsonForType,
  isCompositeCompactKind,
  isSupportedCompactType,
  placeholderForCompactType,
  type CompactTypeEnv,
  type CompactTypeSchema,
} from "@/lib/compact-values";

export function CompactValueInputRow({
  name,
  type,
  typeSchema,
  typeEnv,
  value,
  onChange,
  badge,
  disabled,
}: {
  name: string;
  type: string;
  typeSchema?: CompactTypeSchema;
  typeEnv?: CompactTypeEnv;
  value: string;
  onChange: (val: string) => void;
  badge?: string;
  disabled?: boolean;
}) {
  const kind = compactValueKind(type, typeSchema, typeEnv);
  const byteLen = bytesLengthFromType(type) ?? typeSchema?.length ?? 32;
  const supported = isSupportedCompactType(type, typeSchema, typeEnv);
  const composite = isCompositeCompactKind(kind);

  return (
    <div className="p-2.5 bg-white/[0.03] border border-border/70 rounded-md space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-mono text-text-primary">{name}</span>
        <span className="text-2xs font-mono text-accent/80">{type}</span>
        {badge && (
          <Badge variant="info" size="sm" className="ml-auto">
            {badge}
          </Badge>
        )}
        {composite && supported && (
          <Badge variant="muted" size="sm">
            JSON
          </Badge>
        )}
      </div>
      {!supported ? (
        <p className="text-2xs text-warning leading-relaxed">
          Ledger-state types (Map, Set, MerkleTree, …) cannot be circuit arguments in Compact.
        </p>
      ) : kind === "boolean" ? (
        <select
          value={value === "false" ? "false" : value === "true" ? "true" : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent/60 disabled:opacity-50"
        >
          <option value="">Select…</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : composite ? (
        <div className="space-y-1.5">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            disabled={disabled}
            rows={5}
            placeholder={exampleJsonForType(type, typeSchema, typeEnv)}
            className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/60 disabled:opacity-50 resize-y min-h-[4.5rem]"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(exampleJsonForType(type, typeSchema, typeEnv))}
          >
            Fill example
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            disabled={disabled}
            placeholder={placeholderForCompactType(type, typeSchema, typeEnv)}
            className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/60 disabled:opacity-50"
          />
          {(kind === "bytes" || kind === "coinPublicKey" || kind === "contractAddress") && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              title={`Generate random ${type}`}
              onClick={() => onChange(generateBytesHex(kind === "bytes" ? byteLen : 32))}
            >
              Generate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function WitnessInputRow({
  name,
  type,
  value,
  onChange,
}: {
  name: string;
  type: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <CompactValueInputRow
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      badge="private"
    />
  );
}
