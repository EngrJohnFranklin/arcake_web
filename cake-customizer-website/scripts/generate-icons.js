/**
 * generate-icons.js
 * Generates PWA icons from public/favicon.svg using sharp.
 * Run: node scripts/generate-icons.js
 *
 * Skips generation when all icons already exist (safe for Vercel CI).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public', 'favicon.svg');

const icons = [
  { name: 'pwa-192x192.png',          size: 192 },
  { name: 'pwa-512x512.png',          size: 512 },
  { name: 'pwa-512x512-maskable.png', size: 512 },
  { name: 'apple-touch-icon.png',     size: 180 },
  { name: 'favicon.ico',              size: 48  },
];

// ─── Skip if all icons already exist (avoids sharp dependency in CI) ─────────
const allExist = icons.every(({ name }) =>
  existsSync(resolve(root, 'public', name))
);

if (allExist) {
  console.log('✅ All PWA icons already exist — skipping generation.');
  process.exit(0);
}

// ─── Source SVG required for generation ──────────────────────────────────────
if (!existsSync(svgPath)) {
  console.error('❌ public/favicon.svg not found');
  process.exit(1);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('⚠️  sharp not available — skipping icon generation.');
  console.error('   Icons must already exist in public/ for the build to work.');
  process.exit(0);   // exit 0 so the build continues
}

const svgBuffer = readFileSync(svgPath);

for (const { name, size } of icons) {
  const outPath = resolve(root, 'public', name);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✅ Generated ${name} (${size}x${size})`);
}

console.log('\n🎂 All icons generated in public/');
