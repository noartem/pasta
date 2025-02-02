import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";

export default defineConfig({
    plugins: [
        laravel({
            input: [
                "resources/css/app.css",
                "resources/js/app.js",
                "resources/css/codemirror.css",
                "resources/js/codemirror.js",
            ],
            refresh: true,
        }),
    ],
    resolve: {
        alias: [
            {
                find: "../font",
                replacement: path.resolve(__dirname, "resources/fonts"),
            },
        ],
    },
});
