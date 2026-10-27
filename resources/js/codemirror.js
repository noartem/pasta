import { EditorView, basicSetup } from "codemirror";
import { Compartment, Prec } from "@codemirror/state";
import {
    keymap,
    highlightSpecialChars,
    placeholder,
    Decoration,
    ViewPlugin,
    MatchDecorator,
} from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

import { detectLanguage } from "./detect-language";
import { isLanguage, languageKey, loadLanguage } from "./languages";

import { oneDark } from "@codemirror/theme-one-dark";
import { ayuLight } from "thememirror";

const themeConf = new Compartment();
const lightTheme = ayuLight;
const darkTheme = oneDark;

const languageConf = new Compartment();

// Detection only looks at the start of the document to keep typing in huge pastes fast.
const DETECT_LANGUAGE_CHARS = 20000;
// Re-detect once typing pauses.
const DETECT_LANGUAGE_DELAY_MS = 300;

/**
 * Highlights the editor in the language chosen in `select` (the `language` form field), or in
 * the detected one when "Auto" is chosen. Returns a function to call when the text changes.
 */
function languageSwitcher(view, select) {
    const autoOption = select?.querySelector('option[value=""]');
    const languageName = (id) =>
        select?.querySelector(`option[value="${id}"]`)?.textContent.trim() ?? id;

    let appliedKey = null;
    async function apply() {
        const text = view.state.doc.sliceString(0, DETECT_LANGUAGE_CHARS);
        let id = select?.value ?? "";
        if (!isLanguage(id)) {
            id = detectLanguage(text);
            if (autoOption) autoOption.textContent = `Auto (${languageName(id)})`;
        }

        const key = languageKey(id, text);
        if (key === appliedKey) return;
        appliedKey = key;
        let support;
        try {
            support = await loadLanguage(id, text);
        } catch (error) {
            // Retry next time, unless another language was chosen meanwhile.
            if (appliedKey === key) appliedKey = null;
            console.error(`Failed to load ${id} highlighting`, error);
            return;
        }
        // A later call may have switched to another language while this one was loading.
        if (appliedKey === key) {
            view.dispatch({ effects: languageConf.reconfigure(support) });
        }
    }

    select?.addEventListener("change", apply);
    apply();

    let timer = null;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(apply, DETECT_LANGUAGE_DELAY_MS);
    };
}

const LAYOUT_COOKIE = "pasta_layout";

/** Switches between the full-width and the centered editor; the server reads the cookie. */
function toggleLayout(button) {
    const centered = document.documentElement.classList.toggle("layout-centered");
    document.cookie = centered
        ? `${LAYOUT_COOKIE}=centered; path=/; max-age=31536000; samesite=lax`
        : `${LAYOUT_COOKIE}=; path=/; max-age=0; samesite=lax`;
    if (button) {
        button.textContent = centered ? "full width" : "center";
    }
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

// Alt+<key> (Ctrl+Option+<key> on macOS, where Option alone types characters such as `@`)
// by physical key, so it works in any keyboard layout. AltGr (which Windows reports as
// Ctrl+Alt) types characters and is left alone.
function isAltShortcut(event, code) {
    return (
        event.code === code &&
        event.altKey &&
        event.ctrlKey === isMac &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.getModifierState("AltGraph")
    );
}

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

        const languageSelect = document.getElementById("language-select");
        const initialLanguage = languageSelect?.value ?? "";
        const layoutButton = document.getElementById("layout-toggle");

        const indicateChangesInPageTitle = Boolean(
            editor.getAttribute("data-indicate-changes-in-page-title")
        );

        const autofocus = Boolean(editor.getAttribute("data-autofocus"));
        if (autofocus) {
            textarea.focus();
        }

        let docContentLoaded = false;
        let docContentOriginal = "";

        const indicateChanges = () => {
            if (!indicateChangesInPageTitle) return;

            const changed =
                (docContentLoaded && docContentOriginal !== textarea.value.trim()) ||
                (languageSelect !== null && languageSelect.value !== initialLanguage);
            const changeIndicator = `🔴`;
            const pageHasIndicator = document.title.includes(`${changeIndicator} `);
            if (changed && !pageHasIndicator) {
                document.title = `${changeIndicator} ${document.title}`;
            } else if (!changed && pageHasIndicator) {
                document.title = document.title.replace(`${changeIndicator} `, "");
            }
        };
        let onTextChange = () => {};

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

                        onTextChange();

                        if (!docContentLoaded) {
                            docContentLoaded = true;
                            docContentOriginal = textarea.value.trim();
                            return;
                        }
                        indicateChanges();
                    }
                }),
                EditorView.lineWrapping,

                themeConf.of(isDarkMode() ? darkTheme : lightTheme),

                languageConf.of([]),
            ],
        });

        onTextChange = languageSwitcher(view, languageSelect);
        languageSelect?.addEventListener("change", indicateChanges);
        languageSelect?.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                form.requestSubmit();
            } else if (event.key === "Escape" || event.key === "Enter") {
                event.preventDefault();
                view.focus();
            }
        });

        layoutButton?.addEventListener("click", () => {
            toggleLayout(layoutButton);
            view.focus();
        });
        window.addEventListener(
            "keydown",
            (event) => {
                if (isAltShortcut(event, "KeyW")) {
                    event.preventDefault();
                    toggleLayout(layoutButton);
                } else if (isAltShortcut(event, "KeyL") && languageSelect) {
                    event.preventDefault();
                    languageSelect.focus();
                }
            },
            true
        );

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
