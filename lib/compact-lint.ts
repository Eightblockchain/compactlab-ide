import type { CompileError } from "@/lib/compact";
import { indexToLineCol } from "@/lib/compact-symbols";

export interface LintDiagnostic extends CompileError {
  source: "lint";
  rule?: string;
}

/** Fast client-side checks before server compile. */
export function lintCompactSource(code: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const lines = code.split("\n");

  // Missing pragma
  if (!/pragma\s+language_version/i.test(code)) {
    diagnostics.push({
      line: 1,
      column: 1,
      message:
        "Missing `pragma language_version`. CompactLab will inject one at compile time, but you should declare it explicitly.",
      severity: "warning",
      source: "lint",
      rule: "missing-pragma",
    });
  }

  // Unbalanced braces (ignore strings/comments roughly)
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = stripComments(lines[i]);
    for (const ch of line) {
      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
      if (braceDepth < 0) {
        diagnostics.push({
          line: i + 1,
          column: 1,
          message: "Unexpected `}`. Brace mismatch.",
          severity: "error",
          source: "lint",
          rule: "brace-mismatch",
        });
        braceDepth = 0;
      }
    }
  }
  if (braceDepth > 0) {
    diagnostics.push({
      line: lines.length,
      column: 1,
      message: `${braceDepth} unclosed \`{\`. Add closing brace(s).`,
      severity: "error",
      source: "lint",
      rule: "brace-mismatch",
    });
  }

  // Wrong witness syntax: witness foo: Type;
  const badWitnessRe = /^\s*witness\s+(\w+)\s*:\s*([^;]+);/gm;
  let wm: RegExpExecArray | null;
  while ((wm = badWitnessRe.exec(code)) !== null) {
    const pos = indexToLineCol(code, wm.index);
    diagnostics.push({
      line: pos.line,
      column: pos.column,
      message:
        `Invalid witness syntax \`witness ${wm[1]}: …\`. Use \`witness ${wm[1]}(): ${wm[2].trim()};\` (function form).`,
      severity: "error",
      source: "lint",
      rule: "witness-syntax",
    });
  }

  // pad(N, "literal") — string too long
  const padRe = /pad\s*\(\s*(\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
  let pm: RegExpExecArray | null;
  while ((pm = padRe.exec(code)) !== null) {
    const n = parseInt(pm[1], 10);
    const utf8Len = new TextEncoder().encode(pm[2]).length;
    if (utf8Len > n) {
      const pos = indexToLineCol(code, pm.index);
      diagnostics.push({
        line: pos.line,
        column: pos.column,
        message: `cannot pad "${pm[2]}" to length ${n} since its utf8-equivalent (${utf8Len} bytes) already exceeds that length`,
        severity: "error",
        source: "lint",
        rule: "pad-length",
      });
    }
  }

  // Non-exported ledger fields are on-chain but invisible to ledger() / Contract panel.
  const ledgerRe = /(export\s+)?(sealed\s+)?ledger\s+(\w+)\s*:/g;
  let lm: RegExpExecArray | null;
  while ((lm = ledgerRe.exec(code)) !== null) {
    if (lm[1]) continue;
    const pos = indexToLineCol(code, lm.index);
    diagnostics.push({
      line: pos.line,
      column: pos.column,
      message: `Ledger field \`${lm[3]}\` is not exported. Use \`export ledger ${lm[3]}\` if you want the Contract panel / TypeScript ledger() helper to read it.`,
      severity: "warning",
      source: "lint",
      rule: "ledger-export",
    });
  }

  // Heuristic: witness call result used in ledger op without disclose()
  lintDiscloseHeuristic(code, diagnostics);

  return diagnostics;
}

function lintDiscloseHeuristic(code: string, diagnostics: LintDiagnostic[]) {
  const witnessNames = new Set<string>();
  const witnessRe = /witness\s+(\w+)\s*\(/g;
  let wm: RegExpExecArray | null;
  while ((wm = witnessRe.exec(code)) !== null) {
    witnessNames.add(wm[1]);
  }
  if (witnessNames.size === 0) return;

  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("disclose(")) continue;
    if (!/\.(member|insert|remove|lookup)\s*\(/.test(line)) continue;

    const context = lines.slice(Math.max(0, i - 8), i + 1).join("\n");
    for (const w of witnessNames) {
      if (!new RegExp(`\\b${w}\\s*\\(`).test(context)) continue;
      diagnostics.push({
        line: i + 1,
        column: Math.max(1, line.search(/\.(member|insert|remove|lookup)/) + 1),
        message: `Possible missing \`disclose()\`. Witness \`${w}()\` may flow to this ledger operation. Wrap arguments with disclose() where intentional.`,
        severity: "warning",
        source: "lint",
        rule: "disclose-heuristic",
      });
      break;
    }
  }
}

function stripComments(line: string): string {
  const slash = line.indexOf("//");
  return slash >= 0 ? line.slice(0, slash) : line;
}
