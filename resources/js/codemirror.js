import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import {
    keymap,
    highlightSpecialChars,
    placeholder,
    Decoration,
    ViewPlugin,
    MatchDecorator,
} from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

import { language } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { detectLanguage } from "./detect-language";

import { oneDark } from "@codemirror/theme-one-dark";
import { ayuLight } from "thememirror";

const themeConf = new Compartment();
const lightTheme = ayuLight;
const darkTheme = oneDark;

const languageConf = new Compartment();

const languages = { javascript, html, markdown, php, python, sql, json, css, rust };
const defaultLanguage = "markdown";

// Detection only looks at the start of the document to keep typing in huge pastes fast.
const DETECT_LANGUAGE_CHARS = 20000;

// One LanguageSupport per language, so the installed language can be compared by identity
// (factories like markdown() create a new Language on every call).
const languageSupports = {};
function languageSupport(detected) {
    const name = detected === "unknown" ? defaultLanguage : detected;
    languageSupports[name] ??= languages[name]();
    return languageSupports[name];
}

function detectLanguageSupport(text) {
    return languageSupport(detectLanguage(text.slice(0, DETECT_LANGUAGE_CHARS)));
}

const autoLanguage = EditorState.transactionExtender.of((tr) => {
    if (!tr.docChanged) return null;

    const support = detectLanguageSupport(
        tr.newDoc.sliceString(0, DETECT_LANGUAGE_CHARS)
    );
    if (support.language === tr.startState.facet(language)) {
        return null;
    }
    return {
        effects: languageConf.reconfigure(support),
    };
});

const linkMatcher = new MatchDecorator({
    regexp: /https?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]}]/g,
    decoration: (match) =>
        Decoration.mark({
            class: "cm-link",
            attributes: { title: "Ctrl+Click to open" },
        }),
});

const linkPlugin = ViewPlugin.fromClass(
    class {
        constructor(view) {
            this.decorations = linkMatcher.createDeco(view);
        }
        update(update) {
            this.decorations = linkMatcher.updateDeco(
                update,
                this.decorations
            );
        }
    },
    {
        decorations: (plugin) => plugin.decorations,
        eventHandlers: {
            mousedown(event, view) {
                if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) {
                    return false;
                }
                const pos = view.posAtCoords({
                    x: event.clientX,
                    y: event.clientY,
                });
                if (pos === null) return false;

                let url = null;
                this.decorations.between(pos, pos, (from, to) => {
                    if (from <= pos && pos <= to) {
                        url = view.state.sliceDoc(from, to);
                        return false;
                    }
                });
                if (!url) return false;

                window.open(url, "_blank", "noopener");
                event.preventDefault();
                return true;
            },
        },
    }
);

const CURSOR_STORAGE_KEY = "pasta:cursor";
// A saved cursor is only meant for the page loaded right after saving.
const CURSOR_MAX_AGE_MS = 60 * 1000;

function saveCursor(view) {
    const { anchor, head } = view.state.selection.main;
    try {
        sessionStorage.setItem(
            CURSOR_STORAGE_KEY,
            JSON.stringify({ anchor, head, savedAt: Date.now() })
        );
    } catch (_) {}
}

function restoreCursor(view) {
    let saved = null;
    try {
        saved = JSON.parse(sessionStorage.getItem(CURSOR_STORAGE_KEY));
        sessionStorage.removeItem(CURSOR_STORAGE_KEY);
    } catch (_) {}
    if (!saved || !(Date.now() - saved.savedAt < CURSOR_MAX_AGE_MS)) {
        return false;
    }

    const length = view.state.doc.length;
    const clamp = (n) => Math.max(0, Math.min(Number(n) || 0, length));
    view.dispatch({
        selection: { anchor: clamp(saved.anchor), head: clamp(saved.head) },
        scrollIntoView: true,
    });
    return true;
}

// Ctrl+[ / Ctrl+] (Cmd on macOS) go to the previous / next version, with Alt in a new tab.
// Matched by physical key and ignoring AltGr, which Windows reports as Ctrl+Alt and which
// types `[` / `]` on many keyboard layouts.
function versionNavigation(editor) {
    const targets = {
        BracketLeft: "data-prev-url",
        BracketRight: "data-next-url",
    };
    return Prec.highest(
        EditorView.domEventHandlers({
            keydown(event) {
                if (
                    !(event.ctrlKey || event.metaKey) ||
                    event.shiftKey ||
                    event.getModifierState("AltGraph") ||
                    !(event.code in targets)
                ) {
                    return false;
                }
                const url = editor.getAttribute(targets[event.code]);
                if (!url) {
                    // Nothing to navigate to: keep the default indent bindings.
                    return false;
                }

                event.preventDefault();
                if (event.altKey) {
                    window.open(url, "_blank", "noopener");
                } else {
                    window.location.href = url;
                }
                return true;
            },
        })
    );
}

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

    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
            callback(isDarkMode());
        });
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-codemirror]").forEach((editor) => {
        const form = editor.closest("form");
        form.addEventListener("submit", () => {
            textarea.value = view.state.doc.toString();
            saveCursor(view);
        });

        const forAttribute = editor.getAttribute("data-for");
        const textarea = form.querySelector(`textarea[name="${forAttribute}"]`);

        const indicateChangesInPageTitle = Boolean(
            editor.getAttribute("data-indicate-changes-in-page-title")
        );

        const autofocus = Boolean(editor.getAttribute("data-autofocus"));
        if (autofocus) {
            textarea.focus();
        }

        let docContentLoaded = false;
        let docContentOriginal = "";
        let docContentChanged = false;

        const view = new EditorView({
            parent: editor,
            doc: textarea.value,
            extensions: [
                keymap.of([
                    {
                        key: "Mod-Enter",
                        run: () => {
                            form.requestSubmit();
                            return true;
                        },
                    },
                ]),
                versionNavigation(editor),
                keymap.of([indentWithTab]),
                placeholder(
                    "Paste or type anything… Ctrl+Enter to save. Every save creates a new version. See /about"
                ),
                linkPlugin,

                basicSetup,
                highlightSpecialChars(),

                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        textarea.value = update.state.doc.toString();

                        if (!docContentLoaded) {
                            docContentLoaded = true;
                            docContentOriginal = textarea.value.trim();
                            return;
                        }

                        docContentChanged =
                            docContentOriginal !== textarea.value.trim();

                        if (indicateChangesInPageTitle) {
                            const changeIndicator = `🔴`;
                            const pageHasIndicator = document.title.includes(
                                `${changeIndicator} `
                            );
                            if (docContentChanged && !pageHasIndicator) {
                                document.title = `${changeIndicator} ${document.title}`;
                            } else if (!docContentChanged && pageHasIndicator) {
                                document.title = document.title.replace(
                                    `${changeIndicator} `,
                                    ""
                                );
                            }
                        }
                    }
                }),
                EditorView.lineWrapping,

                themeConf.of(isDarkMode() ? darkTheme : lightTheme),

                languageConf.of(detectLanguageSupport(textarea.value)),
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

        if (restoreCursor(view)) {
            // Stop mirroring the textarea's selection, which would override the restored one.
            textareaListenerAbortController.abort();
            view.focus();
        }
    });
});
