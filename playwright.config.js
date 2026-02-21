// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:8000',
    },
    webServer: {
        command: 'python3 -m http.server 8000',
        url: 'http://localhost:8000',
        reuseExistingServer: true,
        timeout: 10000,
    },
    // Un seul browser suffit pour des tests de logique pure
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
