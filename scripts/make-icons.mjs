import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg');
await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
// maskable : le motif tient dans la zone de sécurité (80 %)
await sharp(svg).resize(400, 400).extend({ top: 56, bottom: 56, left: 56, right: 56, background: '#0b2d8a' }).png().toFile('public/icon-maskable-512.png');
console.log('icônes générées');
