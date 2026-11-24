const MAX_SIDE = 4096;
const MAX_PIXELS = 12_000_000;
const JPEG_FRAME_MARKERS = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]);

function permittedSize(width: number, height: number): boolean {
  return width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_PIXELS;
}

export function isPaymentProof(mime: "image/png" | "image/jpeg", data: string): boolean {
  const bytes = Buffer.from(data, "base64");
  if (mime === "image/png") {
    return bytes.length >= 45 &&
      bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR" &&
      bytes.toString("ascii", bytes.length - 8, bytes.length - 4) === "IEND" &&
      permittedSize(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  if (bytes.length < 12 || bytes.readUInt16BE(0) !== 0xFFD8 || bytes.readUInt16BE(bytes.length - 2) !== 0xFFD9) return false;
  let index = 2;
  while (index < bytes.length - 3 && bytes[index++] === 0xFF) {
    while (bytes[index] === 0xFF) index++;
    const marker = bytes[index++];
    if (marker === undefined || marker === 0xDA || index + 2 > bytes.length) return false;
    const size = bytes.readUInt16BE(index);
    if (size < 2 || index + size > bytes.length) return false;
    if (JPEG_FRAME_MARKERS.has(marker)) {
      return size >= 8 && permittedSize(bytes.readUInt16BE(index + 5), bytes.readUInt16BE(index + 3));
    }
    index += size;
  }
  return false;
}
