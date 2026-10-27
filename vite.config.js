import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    base: "/build/",
    publicDir: false,
    build: {
        manifest: true,
        outDir: "public/build",
        emptyOutDir: true,
        rollupOptions: {
            input: [
                "resources/css/app.css",
                "resources/css/codemirror.css",
                "resources/js/codemirror.js",
                "resources/js/list.js",
            ],
        },
    },
    resolve: {
        alias: [
            {
                find: "../font",
                replacement: path.resolve(__dirname, "resources/fonts"),
            },
        ],
    },
});
