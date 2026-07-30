const fs = require("fs");
const path = require("path");

const sources = [
  {
    input: "C:/Users/lenovo/Downloads/arafa teachers.psd",
    output: path.join(__dirname, "..", "public", "assets", "templates", "template-17.bmp")
  },
];

const requestedInput = process.argv[2] ? path.resolve(process.argv[2]) : "";

for (const source of sources) {
  if (requestedInput && path.resolve(source.input) !== requestedInput) {
    continue;
  }
  if (!fs.existsSync(source.input)) {
    console.warn(`Skipped missing source ${source.input}`);
    continue;
  }
  exportPsdCompositeToBmp(source.input, source.output);
  console.log(`Exported ${source.output}`);
}

function exportPsdCompositeToBmp(input, output) {
  const buffer = fs.readFileSync(input);
  if (buffer.toString("ascii", 0, 4) !== "8BPS") {
    throw new Error(`${input} is not a PSD file`);
  }

  const channels = buffer.readUInt16BE(12);
  const height = buffer.readUInt32BE(14);
  const width = buffer.readUInt32BE(18);
  const depth = buffer.readUInt16BE(22);
  const colorMode = buffer.readUInt16BE(24);

  if (depth !== 8 || colorMode !== 3 || channels < 3) {
    throw new Error(`${input} must be 8-bit RGB PSD`);
  }

  let offset = 26;
  offset += 4 + buffer.readUInt32BE(offset);
  offset += 4 + buffer.readUInt32BE(offset);
  offset += 4 + buffer.readUInt32BE(offset);

  const compression = buffer.readUInt16BE(offset);
  offset += 2;

  const channelPlanes = compression === 0
    ? readRawPlanes(buffer, offset, width, height, channels)
    : readRlePlanes(buffer, offset, width, height, channels);

  const pixelBytes = makeBmpPixels(channelPlanes, width, height);
  const bmp = makeBmp(pixelBytes, width, height);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bmp);
}

function readRawPlanes(buffer, offset, width, height, channels) {
  const planeSize = width * height;
  const planes = [];
  for (let c = 0; c < channels; c += 1) {
    planes.push(buffer.subarray(offset + c * planeSize, offset + (c + 1) * planeSize));
  }
  return planes;
}

function readRlePlanes(buffer, offset, width, height, channels) {
  const rowCount = height * channels;
  const rowLengths = [];
  for (let i = 0; i < rowCount; i += 1) {
    rowLengths.push(buffer.readUInt16BE(offset));
    offset += 2;
  }

  const planes = Array.from({ length: channels }, () => Buffer.alloc(width * height));
  for (let c = 0; c < channels; c += 1) {
    for (let y = 0; y < height; y += 1) {
      const rowLength = rowLengths[c * height + y];
      const rowEnd = offset + rowLength;
      let x = 0;
      while (offset < rowEnd && x < width) {
        let n = buffer.readInt8(offset);
        offset += 1;
        if (n >= 0) {
          const count = n + 1;
          buffer.copy(planes[c], y * width + x, offset, offset + count);
          offset += count;
          x += count;
        } else if (n >= -127) {
          const count = 1 - n;
          const value = buffer[offset];
          offset += 1;
          planes[c].fill(value, y * width + x, y * width + x + count);
          x += count;
        }
      }
      offset = rowEnd;
    }
  }
  return planes;
}

function makeBmpPixels(planes, width, height) {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowStride * height);
  const red = planes[0];
  const green = planes[1];
  const blue = planes[2];

  for (let y = 0; y < height; y += 1) {
    const bmpY = height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const src = y * width + x;
      const dst = bmpY * rowStride + x * 3;
      pixels[dst] = blue[src];
      pixels[dst + 1] = green[src];
      pixels[dst + 2] = red[src];
    }
  }
  return pixels;
}

function makeBmp(pixelBytes, width, height) {
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const pixelOffset = fileHeaderSize + dibHeaderSize;
  const fileSize = pixelOffset + pixelBytes.length;
  const header = Buffer.alloc(pixelOffset);

  header.write("BM", 0, "ascii");
  header.writeUInt32LE(fileSize, 2);
  header.writeUInt32LE(pixelOffset, 10);
  header.writeUInt32LE(dibHeaderSize, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(0, 30);
  header.writeUInt32LE(pixelBytes.length, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);

  return Buffer.concat([header, pixelBytes]);
}
