import type * as Monaco from "monaco-editor";

/** Module bridge so panels can jump the Monaco editor without prop drilling. */
type EditorInstance = Monaco.editor.IStandaloneCodeEditor;

let editor: EditorInstance | null = null;
let monacoRef: typeof Monaco | null = null;

export const compactEditorBridge = {
  register(ed: EditorInstance, monaco: typeof Monaco) {
    editor = ed;
    monacoRef = monaco;
  },

  unregister(ed: EditorInstance) {
    if (editor === ed) {
      editor = null;
      monacoRef = null;
    }
  },

  jumpTo(line: number, column = 1) {
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column });
    editor.focus();
  },

  getEditor() {
    return editor;
  },

  getMonaco() {
    return monacoRef;
  },
};
