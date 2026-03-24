import { chromium } from 'playwright';

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
  
  // Get page HTML to inspect position data
  const html = await page.innerHTML('body');
  console.log('\n=== Checking for position data ===');
  
  // Look for balance info
  if (html.includes('100000') || html.includes('100,000')) {
    console.log('✓ Found balance reference (~$100,000)');
  }
  
  // Look for BTC
  if (html.includes('BTC')) {
    console.log('✓ Found BTC symbol');
  }
  
  // Look for entry price (not 0.0000)
  if (html.includes('entryPrice') || html.includes('Entry')) {
    console.log('✓ Found entry price field');
  }
  
  // Look for P&L
  if (html.includes('P&L') || html.includes('PnL') || html.includes('pnl')) {
    console.log('✓ Found P&L field');
  }
  
  // Get more details from the page
  const pageText = await page.textContent('body');
  console.log('\n=== First 1500 chars of page text ===');
  console.log(pageText.substring(0, 1500));
  
  await browser.close();
})();
