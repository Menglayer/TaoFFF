import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Step 1: Navigate to the page
    console.log('Step 1: Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 2: Wait for WebSocket data to load
    console.log('Step 2: Waiting 5 seconds for WebSocket data to load...');
    await page.waitForTimeout(5000);

    // Step 3: Take initial screenshot
    console.log('Step 3: Taking initial screenshot...');
    await page.screenshot({ path: 'screenshot_1_initial.png', fullPage: true });
    console.log('✓ Screenshot saved: screenshot_1_initial.png');

    // Step 4: Check FilterBar (exchange toggles) - look for all visible text content
    console.log('\nStep 4: Checking FilterBar for exchange toggles...');
    const allText = await page.locator('body').textContent();
    console.log('Page has loaded with content');

    // Step 5 & 6: Look for all exchange mentions
    console.log('\nStep 5-6: Checking which exchanges appear on the page...');
    const exchangesToCheck = ['binance', 'okx', 'bybit', 'bitget', 'gate', 'hyperliquid', 'aster', 'backpack', 'lighter', 'kucoin', 'mexc'];
    
    const foundExchanges = [];
    const missingExchanges = [];
    
    for (const exchange of exchangesToCheck) {
      const regex = new RegExp(exchange, 'i');
      if (regex.test(allText)) {
        foundExchanges.push(exchange);
      } else {
        missingExchanges.push(exchange);
      }
    }

    console.log('\n✓ EXCHANGES FOUND ON PAGE:');
    foundExchanges.forEach(e => console.log(`  - ${e}`));
    
    console.log('\n✗ EXCHANGES NOT FOUND ON PAGE:');
    missingExchanges.forEach(e => console.log(`  - ${e}`));

    // Step 7: Verify expected absent exchanges
    console.log('\nStep 7: Verification results for hidden exchanges...');
    const shouldBeHidden = ['lighter', 'kucoin', 'mexc'];
    const actuallyHidden = shouldBeHidden.filter(ex => missingExchanges.includes(ex));
    const notHidden = shouldBeHidden.filter(ex => foundExchanges.includes(ex));
    
    console.log(`\n✓ Correctly hidden (${actuallyHidden.length}/3): ${actuallyHidden.join(', ')}`);
    if (notHidden.length > 0) {
      console.log(`✗ NOT hidden - FAILED (${notHidden.length}): ${notHidden.join(', ')}`);
    }

    // Step 8: Verify expected present exchanges
    console.log('\nStep 8: Verification results for visible exchanges...');
    const shouldBePresent = ['binance', 'okx', 'bybit', 'bitget', 'gate', 'hyperliquid', 'aster', 'backpack'];
    const actuallyPresent = shouldBePresent.filter(ex => foundExchanges.includes(ex));
    const notPresent = shouldBePresent.filter(ex => missingExchanges.includes(ex));
    
    console.log(`\n✓ Correctly present (${actuallyPresent.length}/${shouldBePresent.length}): ${actuallyPresent.join(', ')}`);
    if (notPresent.length > 0) {
      console.log(`✗ NOT present - ISSUE (${notPresent.length}): ${notPresent.join(', ')}`);
    }

    // Final screenshot
    console.log('\nStep 9: Taking final screenshot...');
    await page.screenshot({ path: 'screenshot_2_final.png', fullPage: true });
    console.log('✓ Screenshot saved: screenshot_2_final.png');

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION SUMMARY:');
    console.log('='.repeat(50));
    if (notHidden.length === 0 && notPresent.length === 0) {
      console.log('✅ ALL CHECKS PASSED');
    } else {
      console.log('❌ SOME CHECKS FAILED');
    }

  } catch (error) {
    console.error('Error during verification:', error.message);
  } finally {
    await browser.close();
  }
})();
