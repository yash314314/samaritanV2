import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const PRODUCT_IMAGES_DIR = '/home/cryogen/pro/samaritanV2/product-images';
const PROMO_IMAGES_DIR = '/home/cryogen/pro/samaritanV2/promo-site/public/images/product';

async function capture() {
  console.log('📸 Capturing Goals interface screenshot...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000/goals', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  const filename = 'samaritan-goals-streaks.png';
  const outPath1 = path.join(PRODUCT_IMAGES_DIR, filename);
  const outPath2 = path.join(PROMO_IMAGES_DIR, filename);

  await page.screenshot({ path: outPath1, fullPage: false });
  fs.copyFileSync(outPath1, outPath2);

  console.log(` Saved ${filename} to both product-images and promo-site/public/images/product/!`);

  await browser.close();
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
