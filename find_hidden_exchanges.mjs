import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Navigating to page...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    console.log('\nSearching for "lighter" in the DOM...');
    const lighterLocations = await page.evaluate(() => {
      const result = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.toLowerCase().includes('lighter')) {
          const parent = node.parentElement;
          result.push({
            text: node.textContent.trim(),
            tagName: parent?.tagName,
            className: parent?.className,
            visible: parent?.offsetHeight > 0,
          });
        }
      }
      return result;
    });

    console.log('lighter found in:', lighterLocations);

    // Also check page HTML directly
    const htmlContent = await page.content();
    const lighterMatches = htmlContent.match(/lighter/gi) || [];
    const kucoinMatches = htmlContent.match(/kucoin/gi) || [];
    const mexcMatches = htmlContent.match(/mexc/gi) || [];

    console.log(`\nlighter occurrences in HTML: ${lighterMatches.length}`);
    console.log(`kucoin occurrences in HTML: ${kucoinMatches.length}`);
    console.log(`mexc occurrences in HTML: ${mexcMatches.length}`);

    // Search for context around these matches
    const lighterIndex = htmlContent.toLowerCase().indexOf('lighter');
    if (lighterIndex > 0) {
      const contextStart = Math.max(0, lighterIndex - 200);
      const contextEnd = Math.min(htmlContent.length, lighterIndex + 200);
      console.log('\nContext around first "lighter" occurrence:');
      console.log(htmlContent.substring(contextStart, contextEnd));
    }

  } finally {
    await browser.close();
  }
})();
