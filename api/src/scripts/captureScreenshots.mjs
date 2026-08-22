import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = '/home/cryogen/pro/samaritanV2/product-images';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const pagesToCapture = [
  { name: 'samaritan-dashboard-overview.png', url: 'http://localhost:3000/' },
  { name: 'samaritan-analytics-insights.png', url: 'http://localhost:3000/analytics' },
  { name: 'samaritan-productivity-heatmap.png', url: 'http://localhost:3000/heatmap' },
  { name: 'samaritan-deep-work-session.png', url: 'http://localhost:3000/focus' },
  { name: 'samaritan-projects-workbench.png', url: 'http://localhost:3000/projects' },
  { name: 'samaritan-calendar-timeblocking.png', url: 'http://localhost:3000/calendar' },
  { name: 'samaritan-goals-streaks.png', url: 'http://localhost:3000/goals' }
];

async function capture() {
  console.log('📸 Starting Samaritan UI Screenshot Capture...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });

  for (const item of pagesToCapture) {
    console.log(` capturing ${item.name} from ${item.url}...`);
    try {
      await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Extra wait for animations & data rendering
      await new Promise(r => setTimeout(r, 2500));

      const filepath = path.join(OUTPUT_DIR, item.name);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(` Saved ${item.name}`);
    } catch (err) {
      console.error(`❌ Error capturing ${item.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('✨ Screenshot capture complete!');
}

capture().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
