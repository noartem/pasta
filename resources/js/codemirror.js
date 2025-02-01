import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

document.addEventListener("DOMContentLoaded", () => {
    const dark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    const editor = document.getElementById("editor");
    if (!editor) return;

    const content = editor.textContent.trim();
    editor.innerHTML = "";

    const form = editor.closest("form");
    form?.addEventListener("submit", () => {
        document.getElementById("content").value = view.state.doc.toString();
    });

    let view = new EditorView({
        parent: editor,
        doc: content,
        extensions: [
            keymap.of([
                {
                    key: "Ctrl-Enter",
                    run: () => {
                        form?.submit();
                        return true;
                    },
                },
                indentWithTab,
            ]),
            basicSetup,
            markdown(),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    document.getElementById("content").value =
                        update.state.doc.toString();
                }
            }),
            ...(dark ? [oneDark] : []),
            EditorView.lineWrapping,
        ],
    });
});
