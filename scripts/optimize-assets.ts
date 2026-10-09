import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
await mkdir('public/images', { recursive: true });
for (const width of [640, 1200])
  await sharp('src/Assets/Picolo_cafe.jpg')
    .rotate()
    .resize(width)
    .webp({ quality: 80 })
    .toFile(`public/images/cafe-${width}.webp`);
