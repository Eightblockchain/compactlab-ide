import type * as Monaco from "monaco-editor";
import type { CompileError } from "@/lib/compact";
import { lintCompactSource, type LintDiagnostic } from "@/lib/compact-lint";

export const DIAGNOSTIC_OWNER = "compactlab";

export function mergeDiagnostics(
  code: string,
  serverErrors?: CompileError[],
): LintDiagnostic[] {
  const lint = lintCompactSource(code);
  const server = (serverErrors ?? []).map(
    (e): LintDiagnostic => ({
      ...e,
      source: "lint",
      severity: e.severity ?? "error",
      rule: "compiler",
    }),
  );

  // Server errors override lint at same line when both exist (compiler wins)
  const serverLines = new Set(server.map((e) => `${e.line}:${e.column}`));
  const filteredLint = lint.filter((d) => {
    if (d.severity === "warning") return true;
    return !serverLines.has(`${d.line}:${d.column}`);
  });

  return [...filteredLint, ...server];
}

export function toMonacoMarkers(
  monaco: typeof Monaco,
  diagnostics: CompileError[],
): Monaco.editor.IMarkerData[] {
  return diagnostics.map((d) => ({
    severity:
      d.severity === "warning"
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Error,
    message: d.message,
    startLineNumber: Math.max(1, d.line),
    startColumn: Math.max(1, d.column),
    endLineNumber: Math.max(1, d.line),
    endColumn: Math.max(1, d.column) + 1,
    source: "compactlab",
  }));
}

export function applyDiagnosticsToModel(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel | null,
  code: string,
  serverErrors?: CompileError[],
): void {
  if (!model || model.isDisposed()) return;
  const merged = mergeDiagnostics(code, serverErrors);
  const markers = toMonacoMarkers(monaco, merged);
  monaco.editor.setModelMarkers(model, DIAGNOSTIC_OWNER, markers);
}
