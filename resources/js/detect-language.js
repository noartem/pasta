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
        keywords: [
            /\bdef\b/g,
            /\bclass\b/g,
            /\bif\b/g,
            /\belif\b/g,
            /\belse:?\b/g,
            /\bimport\b/g,
            /\bfrom\b/g,
            /\bas\b/g,
            /\btry:?\b/g,
            /\bexcept:?\b/g,
            /\bfinally:?\b/g,
            /\bwith\b/g,
            /\blambda\b/g,
            /\byield\b/g,
            /\braise\b/g,
        ],
        syntax: [/:/g, /#/g, /"""/g, /'''/g, /self\./g, /__init__/g],
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
            /\*(.*?)\*/g,
            /^>\s/gm,
            /\[(.*?)\]\((.*?)\)/g,
            /^[-+*]\s/gm,
            /^\d+\.\s/gm,
            /\|/g,
        ],
        syntax: [/^---$/gm, /^===+$/gm, /```/g],
    },
};

export function detectLanguage(sourceCode) {
    const code = sourceCode.trim();

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

    console.log(scores);

    // Determine the language with the highest score.
    const { lang: detectedLang, score: maxScore } = Object.entries(
        scores
    ).reduce(
        (max, [lang, score]) => (score > max.score ? { lang, score } : max),
        { lang: "unknown", score: 0 }
    );

    return maxScore === 0 ? "unknown" : detectedLang;
}
