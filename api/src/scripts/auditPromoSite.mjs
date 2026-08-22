import puppeteer from 'puppeteer';
import path from 'path';

const OUTPUT_DIR = '/home/cryogen/pro/samaritanV2/product-images';

async function audit() {
  console.log('🔍 Auditing Promotional Website 3D Visual Quality...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });

  await page.goto('http://localhost:4173', { waitUntil: 'load', timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'promo-site-3d-hero.png'), fullPage: false });
  console.log(' Saved promo-site-3d-hero.png');

  await browser.close();
  console.log('✨ 3D Audit complete!');
}

audit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
