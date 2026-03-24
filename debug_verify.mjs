import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Step 1: Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Step 2: Waiting 5 seconds for WebSocket data to load...');
    await page.waitForTimeout(5000);

    // Step 3: Get detailed page content via console evaluation
    console.log('\nStep 3: Inspecting page state via JavaScript...');
    const pageState = await page.evaluate(() => {
      // Try to find Zustand store or any global state
      const bodyText = document.body.textContent || '';
      
      return {
        hasLighter: bodyText.toLowerCase().includes('lighter'),
        hasKucoin: bodyText.toLowerCase().includes('kucoin'),
        hasMexc: bodyText.toLowerCase().includes('mexc'),
        pageTitle: document.title,
        bodyLength: bodyText.length,
      };
    });

    console.log('Page state:', pageState);

    // Step 4: Check FilterBar structure
    console.log('\nStep 4: Checking FilterBar structure...');
    const filterBarContent = await page.evaluate(() => {
      // Find all button-like elements that might be exchange toggles
      const buttons = document.querySelectorAll('button');
      const exchanges = [];
      
      buttons.forEach(btn => {
        const text = btn.textContent?.trim().toLowerCase() || '';
        if (['binance', 'okx', 'bybit', 'bitget', 'gate', 'hyperliquid', 'aster', 'backpack', 'lighter', 'kucoin', 'mexc'].some(ex => text.includes(ex))) {
          exchanges.push(text);
        }
      });

      return {
        exchanges,
        totalButtons: buttons.length,
      };
    });

    console.log('FilterBar exchanges found:', filterBarContent);

    // Step 5: Check table headers
    console.log('\nStep 5: Checking table structure...');
    const tableInfo = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      const headerTexts = [];
      
      headers.forEach(header => {
        const text = header.textContent?.trim() || '';
        headerTexts.push(text);
      });

      return {
        headers: headerTexts,
        totalHeaders: headers.length,
      };
    });

    console.log('Table headers:', tableInfo.headers);

    // Step 6: Take screenshot
    console.log('\nStep 6: Taking screenshot...');
    await page.screenshot({ path: 'debug_full_page.png', fullPage: true });
    console.log('✓ Screenshot saved');

    // Step 7: Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log(`lighter found: ${pageState.hasLighter ? '✗ FAILED' : '✓ HIDDEN'}`);
    console.log(`kucoin found: ${pageState.hasKucoin ? '✗ FAILED' : '✓ HIDDEN'}`);
    console.log(`mexc found: ${pageState.hasMexc ? '✗ FAILED' : '✓ HIDDEN'}`);

  } finally {
    await browser.close();
  }
})();
