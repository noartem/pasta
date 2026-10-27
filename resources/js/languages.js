import { StreamLanguage } from "@codemirror/language";

import { csv } from "./csv";
import { detectCsvDelimiter } from "./detect-language";

// Language support by id (the ids from `src/language.rs`). Parsers are loaded on first use,
// so a page only downloads the languages it shows.
const loaders = {
    plaintext: () => [],
    markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
    csv: (text) => csv(detectCsvDelimiter(text) ?? ","),
    json: () => import("@codemirror/lang-json").then((m) => m.json()),
    yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
    html: () => import("@codemirror/lang-html").then((m) => m.html()),
    css: () => import("@codemirror/lang-css").then((m) => m.css()),
    javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
    typescript: () =>
        import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
    python: () => import("@codemirror/lang-python").then((m) => m.python()),
    php: () => import("@codemirror/lang-php").then((m) => m.php()),
    rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
    go: () => import("@codemirror/lang-go").then((m) => m.go()),
    java: () => import("@codemirror/lang-java").then((m) => m.java()),
    cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
    shell: () =>
        import("@codemirror/legacy-modes/mode/shell").then((m) => StreamLanguage.define(m.shell)),
    sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
};

export function isLanguage(id) {
    return Object.hasOwn(loaders, id);
}

/**
 * Cache key of the language support for `id`: CSV support depends on the text's delimiter.
 */
export function languageKey(id, text) {
    return id === "csv" ? `csv:${detectCsvDelimiter(text) ?? ","}` : id;
}

const cache = new Map();

/** The editor extension highlighting `text` as language `id`. */
export function loadLanguage(id, text) {
    const key = languageKey(id, text);
    if (!cache.has(key)) {
        const promise = Promise.resolve(loaders[id](text));
        // A failed download (e.g. during a deploy) is retried next time.
        promise.catch(() => cache.delete(key));
        cache.set(key, promise);
    }
    return cache.get(key);
}
