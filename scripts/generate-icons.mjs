/**
 * Renders the PWA icons (PNG) from the same design as favicon.svg.
 * Run with `npm run icons`; output is committed in public/icons/.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const localChromium = '/opt/pw-browsers/chromium';
const executablePath = existsSync(localChromium) ? localChromium : undefined;

// The maskable icon is full-bleed (the launcher applies its own mask); its
// content stays inside the central 80% safe zone. The regular icon carries
// its own rounded corners.
const svg = ({ maskable }) => {
  const radius = maskable ? 0 : 104;
  const inset = maskable ? 132 : 112;
  const span = 512 - 2 * inset;
  const third1 = inset + span / 3;
  const third2 = inset + (2 * span) / 3;
  const fontSize = maskable ? 96 : 104;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <rect width="512" height="512" rx="${radius}" fill="#5b68c7"/>
    <g stroke="#ffffff" stroke-opacity="0.42" stroke-width="10" stroke-linecap="round">
      <path d="M${third1} ${inset} V${512 - inset} M${third2} ${inset} V${512 - inset} M${inset} ${third1} H${512 - inset} M${inset} ${third2} H${512 - inset}"/>
    </g>
    <text x="256" y="${256 + fontSize * 0.34}" font-family="Avenir Next, Segoe UI, system-ui, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff" text-anchor="middle">5</text>
  </svg>`;
};

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const { file, size, maskable } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0"><div style="width:${size}px;height:${size}px">${svg({ maskable })}</div></body>`,
  );
  const element = page.locator('div');
  await element.screenshot({ path: `public/icons/${file}`, omitBackground: true });
  console.log(`wrote public/icons/${file}`);
}

await browser.close();
