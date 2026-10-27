import {
    HighlightStyle,
    LanguageSupport,
    StreamLanguage,
    syntaxHighlighting,
} from "@codemirror/language";
import { Tag } from "@lezer/highlight";

// Every column gets its own color, cycling ("rainbow CSV").
const columnTags = Array.from({ length: 6 }, () => Tag.define());
const delimiterTag = Tag.define();

const lightColors = ["#c2410c", "#15803d", "#1d4ed8", "#a21caf", "#0e7490", "#a16207"];
const darkColors = ["#f59e0b", "#4ade80", "#60a5fa", "#e879f9", "#22d3ee", "#facc15"];

function columnStyle(colors, themeType) {
    return HighlightStyle.define(
        [
            ...columnTags.map((tag, i) => ({ tag, color: colors[i] })),
            { tag: delimiterTag, color: "#9ca3af" },
        ],
        { themeType }
    );
}

const highlighting = [
    syntaxHighlighting(columnStyle(lightColors, "light")),
    syntaxHighlighting(columnStyle(darkColors, "dark")),
];

const tokenTable = Object.fromEntries([
    ...columnTags.map((tag, i) => [`column${i}`, tag]),
    ["delimiter", delimiterTag],
]);

function csvLanguage(delimiter) {
    return StreamLanguage.define({
        name: "csv",
        startState: () => ({ column: 0, quoted: false }),
        copyState: (state) => ({ ...state }),
        token(stream, state) {
            if (stream.sol() && !state.quoted) {
                state.column = 0;
            }
            const token = `column${state.column % columnTags.length}`;

            if (!state.quoted && stream.peek() === delimiter) {
                stream.next();
                state.column++;
                return "delimiter";
            }
            if (!state.quoted && stream.peek() === '"') {
                stream.next();
                state.quoted = true;
            }
            if (state.quoted) {
                // A quoted field ends at a lone `"`; `""` is an escaped quote. It may span lines.
                while (!stream.eol()) {
                    if (stream.next() === '"') {
                        if (stream.peek() === '"') {
                            stream.next();
                        } else {
                            state.quoted = false;
                            break;
                        }
                    }
                }
                return token;
            }

            while (!stream.eol() && stream.peek() !== delimiter) {
                stream.next();
            }
            return token;
        },
        tokenTable,
    });
}

/** CSV with the given delimiter (`,`, `;` or tab), columns highlighted in rotating colors. */
export function csv(delimiter = ",") {
    return new LanguageSupport(csvLanguage(delimiter), highlighting);
}
