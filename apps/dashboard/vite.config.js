import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
    resolve: {
        alias: {
            crypto: "/src/crypto-shim.ts",
            "node:crypto": "/src/crypto-shim.ts",
        },
    },
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
    },
});
