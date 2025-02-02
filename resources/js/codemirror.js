import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

import { language } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { htmlLanguage, html } from "@codemirror/lang-html";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { php, phpLanguage } from "@codemirror/lang-php";
import { python, pythonLanguage } from "@codemirror/lang-python";
import { detectLanguage } from "./detect-language";

import { oneDark } from "@codemirror/theme-one-dark";
import { tomorrow } from "thememirror";

const languageConf = new Compartment();
const themeConf = new Compartment();

const languages = {
    javascript: [javascriptLanguage, javascript],
    html: [htmlLanguage, html],
    markdown: [markdownLanguage, markdown],
    php: [phpLanguage, php],
    python: [pythonLanguage, python],
};

const defaultLanguage = "markdown";
const [_, createDefaultLanguage] = languages[defaultLanguage];

function detectAndCreateLanguage(content) {
    const newLanguage = detectLanguage(content);
    if (newLanguage === "unknown") {
        return createDefaultLanguage();
    }
    const [_, createNewLanguage] = languages[newLanguage];
    return createNewLanguage();
}

const autoLanguage = EditorState.transactionExtender.of((tr) => {
    if (!tr.docChanged) return null;

    const newLanguage = detectLanguage(tr.newDoc.toString());
    if (newLanguage === "unknown") {
        return createDefaultLanguage();
    }

    const [newLanguageObject, createNewLanguage] = languages[newLanguage];

    const currentLanguageObject = tr.startState.facet(language);
    if (newLanguageObject === currentLanguageObject) {
        return null;
    }
    return {
        effects: languageConf.reconfigure(createNewLanguage()),
    };
});

function isDarkMode() {
    return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

function watchDarkMode(callback) {
    if (!window.matchMedia) {
        return;
    }

    EditorView.baseTheme;

    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
            callback(isDarkMode());
        });
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-codemirror]").forEach((editor) => {
        const content = editor.textContent.trim();
        editor.innerHTML = "";

        const form = editor.closest("form");
        form?.addEventListener("submit", () => {
            document.getElementById("content").value =
                view.state.doc.toString();
        });

        const editorFor = editor.getAttribute("data-for");
        const editorForElement = form.querySelector(`[name="${editorFor}"]`);

        const view = new EditorView({
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

                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        editorForElement.value = update.state.doc.toString();
                    }
                }),
                EditorView.lineWrapping,

                themeConf.of(isDarkMode() ? oneDark : tomorrow),

                languageConf.of(detectAndCreateLanguage(content)),
                autoLanguage,
            ],
        });

        watchDarkMode((isDark) => {
            view.dispatch({
                effects: themeConf.reconfigure(isDark ? oneDark : tomorrow),
            });
        });

        const autofocus = Boolean(editor.getAttribute("data-autofocus"));
        if (autofocus) {
            const autofocusTimer = setInterval(() => {
                view.focus();
                if (view.hasFocus) {
                    clearInterval(autofocusTimer);
                }
            }, 500);
        }
    });
});
