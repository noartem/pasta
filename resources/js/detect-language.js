// `prop: value;`: without one, braces and semicolons are not CSS.
const CSS_DECLARATION = /^[ \t]*[a-z-]+[ \t]*:[ \t]*[^;{}\n]+;[ \t]*$/gm;

const patterns = {
    javascript: {
        keywords: [
            /\bconst\b/g,
            /\blet\b/g,
            /\bvar\b/g,
            /\bfunction\b/g,
            /=>/g,
            /console\.log/g,
            /document\./g,
            /window\./g,
            /addEventListener/g,
            /\btypeof\b/g,
        ],
        // `null` and `undefined` are syntax only: they are common values in tables.
        syntax: [/{/g, /}/g, /;/g, /===/g, /!==/g, /\bnull\b/g, /\bundefined\b/g],
    },
    html: {
        keywords: [
            /<!doctype\s+html>/gi,
            /<html>/gi,
            /<head>/gi,
            /<body>/gi,
            /<div>/gi,
            /<span>/gi,
            /<p>/gi,
            /<a>/gi,
            /<img>/gi,
            /<script>/gi,
            /<link>/gi,
            /<meta>/gi,
        ],
        syntax: [/<\/[a-zA-Z]+>/g, />/g, /</g],
    },
    python: {
        // Anchored to statement shape: "if", "with", "from", "import"... are also English words.
        keywords: [
            /^[ \t]*def\s+\w+\s*\(/gm,
            /^[ \t]*class\s+\w+.*:[ \t]*$/gm,
            /^[ \t]*(?:el)?if\b.*:[ \t]*$/gm,
            /^[ \t]*else[ \t]*:/gm,
            /^[ \t]*(?:from\s+[\w.]+\s+)?import\s+[\w.]+/gm,
            /^[ \t]*(?:try|finally)[ \t]*:/gm,
            /^[ \t]*except\b.*:[ \t]*$/gm,
            /^[ \t]*(?:for|while|with)\b.*:[ \t]*$/gm,
            /\blambda\b[^:\n]*:/g,
            /^[ \t]*(?:yield|raise|return)\b/gm,
        ],
        syntax: [/:[ \t]*$/gm, /^[ \t]*#/gm, /"""/g, /'''/g, /self\./g, /__init__/g],
    },
    php: {
        keywords: [
            /<\?php/g,
            /\?>/g,
            /\becho\b/g,
            /\bfunction\b/g,
            /\bpublic\b/g,
            /\bprivate\b/g,
            /\bprotected\b/g,
            /\$this->/g,
            /\bnamespace\b/g,
            /\buse\b/g,
            /\bclass\b/g,
            /\bextends\b/g,
            /\bimplements\b/g,
        ],
        syntax: [/\$/g, /->/g, /=>/g, /<\?/g, /\?>/g],
    },
    markdown: {
        keywords: [
            /^#{1,6}\s/gm,
            /```/g,
            /\*\*(.*?)\*\*/g,
            /(?<![*\w])\*[^\s*][^*\n]*\*(?![*\w])/g,
            /^>\s/gm,
            // Bounded, so a long run of `[` can't make detection slow.
            /\[[^\]\n]{0,200}\]\([^)\n]{0,500}\)/g,
            /^[-+*]\s/gm,
            /^\d+\.\s/gm,
            /^\|.*\|[ \t]*$/gm,
        ],
        syntax: [/^---$/gm, /^===+$/gm, /```/g],
    },
    sql: {
        keywords: [
            /\bselect\b[^;]{0,500}?\bfrom\b/gi,
            /\binsert\s+into\b/gi,
            /\bupdate\b[^;]{0,500}?\bset\b/gi,
            /\bdelete\s+from\b/gi,
            /\bcreate\s+(?:table|index|view|database|or\s+replace)\b/gi,
            /\balter\s+table\b/gi,
            /\bdrop\s+(?:table|index|view|database)\b/gi,
            /\bwhere\b/gi,
            /\b(?:inner|left|right|full|cross)\s+join\b/gi,
            /\bgroup\s+by\b/gi,
            /\border\s+by\b/gi,
            /\bvalues\b/gi,
            /\bprimary\s+key\b/gi,
            /\b(?:varchar|bigint|timestamp)\b/gi,
        ],
        syntax: [/;[ \t]*$/gm, /--\s/g],
    },
    css: {
        keywords: [
            // Selectors: no `(`, `)` or `=`, which `if (...) {` and `function f() {` have.
            /^[ \t]*[.#]?[\w-][^{};()=\n]*\{[ \t]*$/gm,
            CSS_DECLARATION,
            /@(?:media|import|font-face|keyframes|supports)\b/g,
            /\b\d+(?:px|rem|em|vh|vw)\b/g,
            /#[0-9a-fA-F]{3,8}\b/g,
        ],
        syntax: [/\{/g, /\}/g, /;/g],
    },
    typescript: {
        // Only what plain JavaScript lacks; JavaScript's score is added when any of these match.
        keywords: [
            /:\s*(?:string|number|boolean|any|unknown|void|never)(?:\[\])?\b/g,
            /\binterface\s+[A-Z]\w*(?:<[^>\n]*>)?\s*(?:extends\s+[\w<>, ]+)?\{/g,
            /^[ \t]*(?:export\s+)?type\s+[A-Z]\w*(?:<[^>\n]*>)?\s*=/gm,
            /\bas\s+(?:const|string|number|any|unknown)\b/g,
            /^[ \t]*import\s+type\b/gm,
            /\b(?:private|public|protected)\s+(?:readonly\s+)?\w+\s*:/g,
            /\breadonly\s+\w+\s*:/g,
        ],
        syntax: [],
    },
    go: {
        keywords: [
            /^package\s+\w+[ \t]*$/gm,
            /^func\s+(?:\(\w+\s+\*?\w+\)\s*)?\w+\s*\(/gm,
            /\bfmt\.\w+\(/g,
            /\berr\s*!=\s*nil\b/g,
            /^import\s*\($/gm,
            /\bgo\s+func\b/g,
            /\bchan\s+\w+/g,
            /\bdefer\s+\w+/g,
            /\btype\s+\w+\s+(?:struct|interface)\s*\{/g,
        ],
        syntax: [/:=/g, /\bnil\b/g],
    },
    java: {
        keywords: [
            /\bpublic\s+(?:abstract\s+|final\s+)?(?:class|interface|enum|record)\s+[A-Z]/g,
            /\b(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(?:void|int|long|boolean|String|[A-Z]\w*(?:<[^>\n]*>)?)\s+\w+\s*[(;=]/g,
            /\bSystem\.(?:out|err)\.print/g,
            /^import\s+(?:static\s+)?(?:java|javax|org|com)\.[\w.*]+;/gm,
            /^package\s+[\w.]+;/gm,
            /@(?:Override|Test|Autowired|Deprecated)\b/g,
            /^[ \t]*@[A-Z]\w*(?:\(.*\))?[ \t]*$/gm,
            /\bString\[\]\s+args\b/g,
            /\bnew\s+[A-Z]\w*(?:<[^>\n]*>)?\(/g,
        ],
        syntax: [/;[ \t]*$/gm],
    },
    cpp: {
        keywords: [
            /^#include\s*[<"]/gm,
            /^#(?:define|ifndef|ifdef|endif|pragma)\b/gm,
            /\bstd::/g,
            /\bint\s+main\s*\(/g,
            /\b(?:printf|scanf|malloc|free|sizeof)\s*\(/g,
            /\b(?:cout|cin|endl)\b/g,
            /\b(?:nullptr|template\s*<|unsigned|typedef)\b/g,
            /\b(?:void|char|int)\s*\*\s*\w+/g,
            // `int add(int a, int b) {` (Java has a visibility keyword first).
            /^(?:static\s+)?(?:int|void|char|float|double|long|unsigned|bool|size_t)\s+\**\w+\s*\([^)\n]*\)\s*\{?[ \t]*$/gm,
        ],
        syntax: [
            /->/g,
            /;[ \t]*$/gm,
            // Local variables like `int i = 0;`, which Java has too.
            /^[ \t]+(?:int|char|float|double|long|unsigned|size_t)\s+\**\w+\s*(?:\[\w*\]\s*)?[=;]/gm,
        ],
    },
    shell: {
        // Commands at the start of a line (optionally after a `$ ` prompt).
        keywords: [
            /^[ \t]*(?:\$\s+)?(?:sudo|apt|apt-get|brew|npm|npx|yarn|pnpm|pip|pip3|cargo|docker|git|cd|ls|mkdir|rm|cp|mv|chmod|chown|curl|wget|export|echo|source|systemctl|kubectl|ssh|scp|tar|cat|grep|find|make|python3?|node)\s/gm,
            /\|\s*(?:grep|awk|sed|xargs|sort|uniq|head|tail|wc|tee|jq)\b/g,
            /^[ \t]*(?:fi|done|esac|then)\b/gm,
            /\[\[\s/g,
            /\$\{\w+[}:]/g,
            /\b2>&1|\/dev\/null/g,
        ],
        syntax: [/&&/g, /\s--?[a-z][\w-]*/g],
    },
    rust: {
        keywords: [
            /\bfn\s+\w+/g,
            /\blet\s+mut\b/g,
            /\bimpl\b/g,
            /\bpub\s+(?:fn|struct|enum|mod|use|trait)\b/g,
            /\buse\s+(?:std|crate|super|self)\b/g,
            /\b(?:println|print|format|vec|panic|assert|assert_eq|write|writeln)!/g,
            /\bstruct\s+[A-Z]\w*/g,
            /\benum\s+[A-Z]\w*/g,
            /\btrait\s+[A-Z]\w*/g,
            /\bmatch\b/g,
            /#!?\[[a-z_]+(?:\(.*?\))?\]/g,
            /&(?:mut\s+)?(?:self|str)\b/g,
            /\b(?:Option|Result|Vec|String|Box)</g,
        ],
        // Syntax only: `None` is a common value in tables.
        syntax: [/::/g, /->/g, /\{/g, /\}/g, /;/g, /\b(?:Some|None|Ok|Err)\b/g],
    },
};

function isJson(code) {
    if (!/^[[{]/.test(code)) return false;
    try {
        const parsed = JSON.parse(code);
        return typeof parsed === "object" && parsed !== null;
    } catch {
        return false;
    }
}

// Splits CSV text into records (quoted fields may contain delimiters and line breaks) and
// counts the delimiters in each one, and how many of them are followed by a space.
function parseRecords(text, delimiter) {
    const counts = [];
    let spaced = 0;
    let count = 0;
    let quoted = false;
    let fieldStart = true;
    let empty = true;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') i++;
                else quoted = false;
            }
            continue;
        }
        if (ch === delimiter) {
            count++;
            if (text[i + 1] === " ") spaced++;
            fieldStart = true;
            empty = false;
            continue;
        }
        if (ch === "\n") {
            if (!empty) counts.push(count);
            count = 0;
            fieldStart = true;
            empty = true;
            continue;
        }
        // Like the highlighter (csv.js): only a field's first character opens quotes.
        if (ch === '"' && fieldStart) {
            quoted = true;
        }
        fieldStart = false;
        if (ch !== "\r" && ch !== " " && ch !== "\t") {
            empty = false;
        }
    }
    if (!empty) counts.push(count);
    return { counts, spaced };
}

const CSV_DELIMITERS = ["\t", ",", ";"];
const CSV_SAMPLE_RECORDS = 100;

/**
 * Delimiter of CSV-like text: every record (one stray record per ten is allowed, e.g. a cut-off
 * last line) has the same number of it. `null` if the text doesn't look like CSV.
 */
export function detectCsvDelimiter(text) {
    const lines = nonEmptyLines(text);
    for (const delimiter of CSV_DELIMITERS) {
        const records = parseRecords(text, delimiter);
        const counts = records.counts.slice(0, CSV_SAMPLE_RECORDS);
        if (counts.length < 2) return null;

        const columns = counts[0];
        if (columns < 1) continue;
        // Prose: "Hi John, how are you?" has a space after (nearly) every comma.
        const total = records.counts.reduce((sum, count) => sum + count, 0);
        if (delimiter !== "\t" && records.spaced * 2 >= total) continue;
        const stray = counts.filter((count) => count !== columns).length;
        if (stray > Math.floor(counts.length / 10)) continue;

        // Statements ending with `;` (SQL, code) look like records with an empty last field.
        if (lines.every((line) => line.trimEnd().endsWith(delimiter))) continue;

        return delimiter;
    }
    return null;
}

function nonEmptyLines(text) {
    return text.split("\n").filter((line) => line.trim() !== "");
}

const YAML_LINE = /^[ \t]*(?:#.*|---|\.\.\.|-|- .*|[\w./"'-][\w ./"'-]*:(?:[ \t].*)?)$/;
const YAML_KEY = /^[ \t]*(?:- )?[\w./"'-][\w ./"'-]*:(?:[ \t]+\S.*)?$/;

// Mostly `key: value` lines, list items and comments.
function isYaml(text) {
    const lines = nonEmptyLines(text).slice(0, 200);
    if (lines.length < 2) return false;
    const keys = lines.filter((line) => YAML_KEY.test(line)).length;
    const yamlLines = lines.filter((line) => YAML_LINE.test(line)).length;
    // Nesting, a list or a document marker; a few `Name: John` lines are just notes.
    const structured = lines.some((line) => /^(?:[ \t]+\S|-(?: |$)|---)/.test(line));
    return (
        yamlLines / lines.length >= 0.9 &&
        (structured ? keys >= 2 : keys >= 5) &&
        keys / lines.length >= 0.3 &&
        // `prop: value;` is CSS.
        !lines.some((line) => /;[ \t]*$/.test(line))
    );
}

// Each language's keyword patterns, for testing single lines.
const LINE_KEYWORDS = Object.fromEntries(
    Object.entries(patterns).map(([lang, { keywords }]) => [
        lang,
        keywords.map((keyword) => new RegExp(keyword.source, keyword.flags.replace("g", ""))),
    ])
);

// A couple of common English words ("if", "with", "from") must not turn prose into code.
const MIN_SCORE = 3;

/**
 * Language id (see `src/language.rs`) of the text; `plaintext` if nothing matches.
 */
export function detectLanguage(sourceCode) {
    const code = sourceCode.trim();

    if (code === "") {
        return "plaintext";
    }
    if (isJson(code)) {
        return "json";
    }
    // Code blocks in fences are part of a Markdown document, whatever their language.
    if ((code.match(/^[ \t]*```/gm) || []).length >= 2) {
        return "markdown";
    }
    const shebang = code.match(/^#!.*\b(python[\d.]*|node|(?:ba|z|k|da)?sh)\b/);
    if (shebang) {
        if (shebang[1].startsWith("python")) return "python";
        return shebang[1] === "node" ? "javascript" : "shell";
    }
    if (/^<\?xml\b/.test(code)) {
        return "html";
    }
    if (isYaml(code)) {
        return "yaml";
    }

    const scores = Object.fromEntries(
        Object.keys(patterns).map((lang) => [lang, 0])
    );

    // Count occurrences of each regex pattern in the source code.
    for (const [lang, patternSet] of Object.entries(patterns)) {
        for (const keywordRegex of patternSet.keywords) {
            const matches = code.match(keywordRegex);
            if (matches) {
                scores[lang] += matches.length * 2;
            }
        }

        // Braces and semicolons alone don't make a language, they only add to its keywords.
        if (scores[lang] === 0) continue;
        for (const syntaxRegex of patternSet.syntax) {
            const matches = code.match(syntaxRegex);
            if (matches) {
                scores[lang] += matches.length;
            }
        }
    }

    // Boost scores for specific starting patterns.
    if (code.startsWith("<?php")) {
        scores.php += 10;
    }
    if (
        code.toLowerCase().startsWith("<!doctype html") ||
        code.toLowerCase().startsWith("<html>")
    ) {
        scores.html += 10;
    }

    // `name: string;` in a TypeScript class also looks like a declaration.
    if (!new RegExp(CSS_DECLARATION).test(code) || scores.typescript > 0) {
        scores.css = 0;
    }
    // PHP's keywords (`public`, `class`, `use`, `echo`...) are shared with Java, shell and
    // English: require `<?php` or `$variables` in `;`-terminated statements (not `$20`).
    if (!/<\?php/.test(code) && !(/\$[A-Za-z_]\w*/.test(code) && /;[ \t]*$/m.test(code))) {
        scores.php = 0;
    }
    if (scores.typescript > 0) {
        scores.typescript += scores.javascript;
    }

    // Determine the language with the highest score.
    const { lang: detectedLang, score: maxScore } = Object.entries(
        scores
    ).reduce(
        (max, [lang, score]) => (score > max.score ? { lang, score } : max),
        { lang: "unknown", score: 0 }
    );

    // A table, unless (nearly) every line has a keyword of the detected language: a table's
    // delimiters (`,` `;`) are also code syntax.
    if (detectCsvDelimiter(code) !== null) {
        const keywords = LINE_KEYWORDS[detectedLang] ?? [];
        const lines = nonEmptyLines(code).slice(0, CSV_SAMPLE_RECORDS);
        const codeLines = lines.filter((line) =>
            keywords.some((keyword) => keyword.test(line))
        ).length;
        if (maxScore < MIN_SCORE || codeLines < lines.length * 0.9) {
            return "csv";
        }
    }

    return maxScore < MIN_SCORE ? "plaintext" : detectedLang;
}
