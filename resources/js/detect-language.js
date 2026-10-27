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
            /\bnull\b/g,
            /\bundefined\b/g,
        ],
        syntax: [/{/g, /}/g, /;/g, /===/g, /!==/g],
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
            /\[(.*?)\]\((.*?)\)/g,
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
            /^[ \t]*[.#]?[\w-][^{};\n]*\{[ \t]*$/gm,
            /^[ \t]*[a-z-]+[ \t]*:[ \t]*[^;{}\n]+;[ \t]*$/gm,
            /@(?:media|import|font-face|keyframes|supports)\b/g,
            /\b\d+(?:px|rem|em|vh|vw)\b/g,
            /#[0-9a-fA-F]{3,8}\b/g,
        ],
        syntax: [/\{/g, /\}/g, /;/g],
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
            /\b(?:Some|None|Ok|Err)\b/g,
        ],
        syntax: [/::/g, /->/g, /\{/g, /\}/g, /;/g],
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

// A couple of common English words ("if", "with", "from") must not turn prose into code.
const MIN_SCORE = 3;

export function detectLanguage(sourceCode) {
    const code = sourceCode.trim();

    if (isJson(code)) {
        return "json";
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

    // Determine the language with the highest score.
    const { lang: detectedLang, score: maxScore } = Object.entries(
        scores
    ).reduce(
        (max, [lang, score]) => (score > max.score ? { lang, score } : max),
        { lang: "unknown", score: 0 }
    );

    return maxScore < MIN_SCORE ? "unknown" : detectedLang;
}
