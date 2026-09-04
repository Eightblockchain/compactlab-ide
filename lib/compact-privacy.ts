import {
  extractCircuitBodies,
  extractLedgerVars,
  extractWitnesses,
  findIdentifierOccurrences,
  locForName,
  maskStringsAndComments,
  type CompactLocation,
} from "@/lib/compact-symbols";

export type PrivacyKind = "private" | "public" | "disclose" | "hash";

export interface PrivacySpan extends CompactLocation {
  kind: PrivacyKind;
  name: string;
  note: string;
}

export interface PrivacyFlow {
  from: string;
  to: string;
  via: string;
  line: number;
}

export interface PrivacyAnalysis {
  spans: PrivacySpan[];
  flows: PrivacyFlow[];
  summary: { private: number; public: number; disclose: number; hash: number };
}

const HASH_FNS = ["persistentHash", "persistentCommit", "transientHash", "transientCommit"];

function addSpan(
  spans: PrivacySpan[],
  loc: CompactLocation,
  kind: PrivacyKind,
  name: string,
  note: string,
) {
  spans.push({ ...loc, kind, name, note });
}

export function analyzePrivacy(code: string): PrivacyAnalysis {
  const spans: PrivacySpan[] = [];
  const flows: PrivacyFlow[] = [];
  const witnesses = extractWitnesses(code);
  const ledger = extractLedgerVars(code);
  const bodies = extractCircuitBodies(code);
  const witnessNames = new Set(witnesses.map((w) => w.name));
  const ledgerNames = new Set(ledger.map((v) => v.name));

  for (const w of witnesses) {
    if (!w.line || !w.column) continue;
    addSpan(
      spans,
      { line: w.line, column: w.column, endColumn: w.endColumn ?? w.column + w.name.length },
      "private",
      w.name,
      `Witness. Stays off-chain unless you disclose a derived value.`,
    );
    for (const occ of findIdentifierOccurrences(code, w.name)) {
      if (occ.line === w.line && occ.column === w.column) continue;
      addSpan(spans, occ, "private", w.name, `Use of witness \`${w.name}()\`.`);
    }
  }

  for (const v of ledger) {
    if (!v.line || !v.column) continue;
    addSpan(
      spans,
      { line: v.line, column: v.column, endColumn: v.endColumn ?? v.column + v.name.length },
      "public",
      v.name,
      `Ledger. Public on-chain state.`,
    );
    for (const occ of findIdentifierOccurrences(code, v.name)) {
      if (occ.line === v.line && occ.column === v.column) continue;
      addSpan(spans, occ, "public", v.name, `Ledger field \`${v.name}\` (public).`);
    }
  }

  for (const body of bodies) {
    for (const p of body.params) {
      const paramOcc = findIdentifierOccurrences(body.body, p.name);
      for (const occ of paramOcc) {
        addSpan(
          spans,
          {
            line: body.bodyStartLine + occ.line - 1,
            column: occ.column,
            endColumn: occ.endColumn,
          },
          "private",
          p.name,
          `Circuit argument \`${p.name}\` is private until disclose().`,
        );
      }
    }
  }

  const masked = maskStringsAndComments(code);
  const discloseRe = /\bdisclose\s*\(/g;
  let dm: RegExpExecArray | null;
  while ((dm = discloseRe.exec(masked)) !== null) {
    const loc = locForName(code, dm.index, "disclose");
    addSpan(spans, loc, "disclose", "disclose", "Explicit disclosure of witness-derived data.");
    const after = code.slice(dm.index, dm.index + 160);
    const inner = after.match(/disclose\s*\(\s*([A-Za-z_]\w*)/);
    const assign = code
      .slice(Math.max(0, dm.index - 80), dm.index + 160)
      .match(/(\w+)\s*=\s*disclose/);
    const ledgerOp = code
      .slice(dm.index, Math.min(code.length, dm.index + 200))
      .match(/\.((?:insert|member|remove|lookup))\s*\(\s*disclose/);
    if (inner && assign && ledgerNames.has(assign[1])) {
      flows.push({
        from: inner[1],
        to: assign[1],
        via: "disclose → ledger assign",
        line: loc.line,
      });
    } else if (inner && ledgerOp) {
      flows.push({
        from: inner[1],
        to: ledgerOp[1],
        via: `disclose → ${ledgerOp[1]}()`,
        line: loc.line,
      });
    } else if (inner) {
      flows.push({
        from: inner[1],
        to: "(public)",
        via: "disclose",
        line: loc.line,
      });
    }
  }

  for (const fn of HASH_FNS) {
    const re = new RegExp(`\\b${fn}\\s*\\(`, "g");
    let hm: RegExpExecArray | null;
    while ((hm = re.exec(masked)) !== null) {
      const loc = locForName(code, hm.index, fn);
      addSpan(spans, loc, "hash", fn, `${fn} hides the preimage; result is still witness-tainted until disclose().`);
      const nearby = code.slice(Math.max(0, hm.index - 40), hm.index + 120);
      const bind = nearby.match(/(?:const|let)\s+(\w+)\s*=/);
      const fromW = [...witnessNames].find((w) => nearby.includes(w));
      if (bind) {
        flows.push({
          from: fromW ?? "(secret)",
          to: bind[1],
          via: fn,
          line: loc.line,
        });
      }
    }
  }

  // Missing disclose: witness-named value used in ledger op
  for (const body of bodies) {
    const lines = body.body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes("disclose(")) continue;
      if (!/\.(insert|member|remove|lookup)\s*\(/.test(line) && !/^\s*\w+\s*=/.test(line)) continue;
      for (const w of witnessNames) {
        const window = lines.slice(Math.max(0, i - 6), i + 1).join("\n");
        if (!new RegExp(`\\b${w}\\s*\\(`).test(window) && !new RegExp(`\\b${w}\\b`).test(line)) continue;
        flows.push({
          from: w,
          to: "(ledger)",
          via: "possible missing disclose",
          line: body.bodyStartLine + i,
        });
      }
    }
  }

  const kindCount = (k: PrivacyKind) => new Set(spans.filter((s) => s.kind === k).map((s) => `${s.line}:${s.column}`)).size;
  return {
    spans,
    flows,
    summary: {
      private: kindCount("private"),
      public: kindCount("public"),
      disclose: kindCount("disclose"),
      hash: kindCount("hash"),
    },
  };
}
