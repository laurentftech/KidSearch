// @ts-check
const { test, expect } = require('@playwright/test');

test('KidSearch — tous les tests qualité passent', async ({ page }) => {
    await page.goto('/test_quality.html');

    // Attend que le runner ait fini (le résumé est mis à jour de façon synchrone,
    // mais DOMPurify est chargé depuis un CDN — on attend qu'il soit prêt)
    await page.waitForFunction(() => {
        const summary = document.getElementById('summary');
        return summary && !summary.textContent.includes('Exécution');
    }, { timeout: 10000 });

    // Récupère les compteurs
    const passed = await page.$eval('#summary .passed', el => {
        const m = el.textContent.match(/\d+/);
        return m ? parseInt(m[0]) : 0;
    });

    const failedEl = await page.$('#summary .failed');
    const failed = failedEl
        ? await failedEl.evaluate(el => {
            const m = el.textContent.match(/\d+/);
            return m ? parseInt(m[0]) : 0;
          })
        : 0;

    // Récupère le détail des tests échoués pour le message d'erreur
    const failedDetails = await page.$$eval('.test-case.fail', nodes =>
        nodes.map(n => {
            const name = n.querySelector('.test-name')?.childNodes[0]?.textContent?.trim() || '?';
            const detail = n.querySelector('.test-detail')?.textContent?.trim() || '';
            return detail ? `  • ${name}\n    ${detail}` : `  • ${name}`;
        })
    );

    console.log(`\n  ✓ ${passed} test(s) passé(s)`);
    if (failed > 0) {
        console.log(`\n  Échecs :\n${failedDetails.join('\n')}`);
    }

    expect(failed, `${failed} test(s) échoué(s) :\n${failedDetails.join('\n')}`).toBe(0);
});
