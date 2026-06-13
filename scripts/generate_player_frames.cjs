const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 32, H = 48;

function createPNG(pixels) {
  // pixels: Uint8Array of RGBA (W * H * 4 bytes), row-major, top-to-bottom
  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // CRC32
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // Build raw data: filter byte (0=None) + RGBA rows
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0; // filter none
    for (let x = 0; x < W; x++) {
      const src = (y * W + x) * 4;
      const dst = y * (W * 4 + 1) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderFrame(dir, frame) {
  const pixels = new Uint8Array(W * H * 4); // all zeros = transparent
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);

  const frameOffsets = [0, -3, -5, -3, 2, 5];
  const fo = frameOffsets[frame];
  const isRight = dir === 1;

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const idx = (y * W + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }

  function fillRect(x1, y1, w, h, r, g, b, a) {
    for (let y = y1; y < y1 + h && y < H; y++) {
      for (let x = x1; x < x1 + w && x < W; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  function fillCircle(cx, cy, radius, r, g, b, a) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setPixel(cx + dx, cy + dy, r, g, b, a);
        }
      }
    }
  }

  function fillTriangle(x1, y1, x2, y2, x3, y3, r, g, b, a) {
    const minX = Math.max(0, Math.min(x1, x2, x3));
    const maxX = Math.min(W - 1, Math.max(x1, x2, x3));
    const minY = Math.max(0, Math.min(y1, y2, y3));
    const maxY = Math.min(H - 1, Math.max(y1, y2, y3));

    function edge(px, py, ax, ay, bx, by) {
      return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    }

    const e01 = (x, y) => edge(x, y, x1, y1, x2, y2);
    const e12 = (x, y) => edge(x, y, x2, y2, x3, y3);
    const e20 = (x, y) => edge(x, y, x3, y3, x1, y1);

    // determine winding by checking sign consistency
    const s01 = e01(0, 0), s12 = e12(0, 0), s20 = e20(0, 0);
    const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const ccw = area > 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = e12(x, y);
        const w1 = e20(x, y);
        const w2 = e01(x, y);
        if (ccw) {
          if (w0 >= 0 && w1 >= 0 && w2 >= 0) setPixel(x, y, r, g, b, a);
        } else {
          if (w0 <= 0 && w1 <= 0 && w2 <= 0) setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  // Diamond base
  const diamondColor = [0x66, 0x99, 0xcc];
  // Diamond: 4 vertices
  const dxV = [cx, cx + 14, cx, cx - 14];
  const dyV = [cy - 10, cy, cy + 10, cy];
  // Draw diamond as two triangles
  fillTriangle(dxV[0], dyV[0], dxV[1], dyV[1], dxV[2], dyV[2], diamondColor[0], diamondColor[1], diamondColor[2], 255);
  fillTriangle(dxV[2], dyV[2], dxV[3], dyV[3], dxV[0], dyV[0], diamondColor[0], diamondColor[1], diamondColor[2], 255);

  // Body rectangle (shifted by frame offset)
  const bodyColor = [0x88, 0xcc, 0xff];
  const bx = isRight ? cx - 6 - fo : cx - 10 + fo;
  fillRect(bx, cy - 18, 12, 20, bodyColor[0], bodyColor[1], bodyColor[2], 255);

  // Indicator circle (moves opposite to body)
  const indicatorColor = [0xff, 0xdd, 0x44];
  const fx = isRight ? cx + 8 + fo : cx - 8 - fo;
  const fy = isRight ? cy - 6 : cy + 10;
  fillCircle(fx, fy, 3, indicatorColor[0], indicatorColor[1], indicatorColor[2], 204);

  return pixels;
}

// --- Main ---
const outDir = path.join(__dirname, '..', 'public', 'assets', 'sprites', 'player');
fs.mkdirSync(outDir, { recursive: true });

const dirNames = ['bottom_left', 'top_right'];
for (let dir = 0; dir < 2; dir++) {
  for (let frame = 0; frame < 6; frame++) {
    const pixels = renderFrame(dir, frame);
    const png = createPNG(pixels);
    const filename = `player_${dirNames[dir]}_${frame}.png`;
    fs.writeFileSync(path.join(outDir, filename), png);
    console.log(`Wrote ${filename} (${png.length} bytes)`);
  }
}

console.log('Done — 12 frames generated.');
