/**
 * generate-icons.js
 * Generates PWA icons from public/favicon.svg using sharp.
 * Run: node scripts/generate-icons.js
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public', 'favicon.svg');

if (!existsSync(svgPath)) {
  console.error('❌ public/favicon.svg not found');
  process.exit(1);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('❌ sharp not installed. Run: npm install --save-dev sharp');
  process.exit(1);
}

const svgBuffer = readFileSync(svgPath);

const icons = [
  { name: 'pwa-192x192.png',          size: 192 },
  { name: 'pwa-512x512.png',          size: 512 },
  { name: 'pwa-512x512-maskable.png', size: 512 },
  { name: 'apple-touch-icon.png',     size: 180 },
  { name: 'favicon.ico',              size: 48  },
];

for (const { name, size } of icons) {
  const outPath = resolve(root, 'public', name);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✅ Generated ${name} (${size}x${size})`);
}

console.log('\n🎂 All icons generated in public/');
