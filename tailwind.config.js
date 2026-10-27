import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./templates/**/*.html", "./resources/**/*.js"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Figtree", ...defaultTheme.fontFamily.sans],
                mono: ["Fira Code", ...defaultTheme.fontFamily.mono],
            },
        },
    },
    plugins: [],
};
