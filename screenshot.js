const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:5173/trade...');
  await page.goto('http://localhost:5173/trade', { waitUntil: 'networkidle' });
  
  console.log('Waiting 4 seconds for WebSocket data to load...');
  await page.waitForTimeout(4000);
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'trade-page.png', fullPage: true });
  
  console.log('Screenshot saved to trade-page.png');
  
  // Extract visible text content
  const pageText = await page.textContent('body');
  console.log('\n=== PAGE CONTENT ===');
  console.log(pageText.substring(0, 2000));
  
  await browser.close();
})();
