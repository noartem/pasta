import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap, highlightSpecialChars } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

import { language } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { htmlLanguage, html } from "@codemirror/lang-html";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { php, phpLanguage } from "@codemirror/lang-php";
import { python, pythonLanguage } from "@codemirror/lang-python";
import { detectLanguage } from "./detect-language";

import { oneDark } from "@codemirror/theme-one-dark";
import { ayuLight } from "thememirror";

const themeConf = new Compartment();
const lightTheme = ayuLight;
const darkTheme = oneDark;

const languageConf = new Compartment();

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
        const form = editor.closest("form");
        form?.addEventListener("submit", () => {
            document.getElementById("content").value =
                view.state.doc.toString();
        });

        const forAttribute = editor.getAttribute("data-for");
        const textarea = form.querySelector(`textarea[name="${forAttribute}"]`);

        const autofocus = Boolean(editor.getAttribute("data-autofocus"));
        if (autofocus) {
            textarea.focus();
        }

        const view = new EditorView({
            parent: editor,
            doc: textarea.value,
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
                highlightSpecialChars(),

                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        textarea.value = update.state.doc.toString();
                    }
                }),
                EditorView.lineWrapping,

                themeConf.of(isDarkMode() ? darkTheme : lightTheme),

                languageConf.of(detectAndCreateLanguage(textarea.value)),
                autoLanguage,
            ],
        });

        watchDarkMode((isDark) => {
            view.dispatch({
                effects: themeConf.reconfigure(isDark ? darkTheme : lightTheme),
            });
        });

        const updateSelectionFromTextare = () =>
            view.dispatch({
                selection: {
                    head: textarea.selectionStart,
                    anchor: textarea.selectionStart,
                },
                scrollIntoView: true,
            });
        const updateValueFromTextarea = () =>
            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: textarea.value,
                },
            });

        if (autofocus) {
            const autofocusTimer = setInterval(() => {
                view.focus();
                if (view.hasFocus) {
                    clearInterval(autofocusTimer);
                }
            }, 500);
        }

        const textareaListenerAbortController = new AbortController();
        const waitFocusTimer = setInterval(() => {
            if (view.hasFocus) {
                textareaListenerAbortController.abort();
                textarea.style.display = "none";
                clearInterval(waitFocusTimer);
            }
        }, 100);

        updateSelectionFromTextare();
        textarea.addEventListener(
            "selectionchange",
            updateSelectionFromTextare,
            { signal: textareaListenerAbortController.signal }
        );

        updateValueFromTextarea();
        textarea.addEventListener("input", updateValueFromTextarea, {
            signal: textareaListenerAbortController.signal,
        });
    });
});
