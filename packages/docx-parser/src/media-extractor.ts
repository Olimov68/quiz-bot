import crypto from 'node:crypto';
import JSZip from 'jszip';
import { ExtractedMedia } from '@smart-quiz/shared';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per image

export async function extractMediaFromZip(
  zip: JSZip,
  relsXmlString: string
): Promise<Map<string, ExtractedMedia>> {
  const mediaMap = new Map<string, ExtractedMedia>();
  if (!relsXmlString) return mediaMap;

  // Parse rels XML to find rId -> target file mapping
  // <Relationship Id="rId5" Type=".../image" Target="media/image1.png"/>
  const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Type="[^"]*image"[^>]+Target="([^"]+)"/gi;
  let match: RegExpExecArray | null;

  const rIdToTarget = new Map<string, string>();
  while ((match = relRegex.exec(relsXmlString)) !== null) {
    const rId = match[1];
    let target = match[2];
    // Normalize target path (e.g. "media/image1.png" or "/word/media/image1.png")
    if (!target.startsWith('word/')) {
      target = `word/${target.replace(/^\//, '')}`;
    }
    rIdToTarget.set(rId, target);
  }

  for (const [rId, targetPath] of rIdToTarget.entries()) {
    const zipEntry = zip.file(targetPath);
    if (!zipEntry) continue;

    const buffer = await zipEntry.async('nodebuffer');
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) continue;

    const mimeType = detectImageMimeType(buffer, targetPath);
    if (!mimeType) continue; // Unsupported or unsafe format

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const base64 = buffer.toString('base64');
    const filename = targetPath.split('/').pop() || `image_${rId}`;

    mediaMap.set(rId, {
      id: rId,
      originalName: filename,
      mimeType,
      dataBase64: `data:${mimeType};base64,${base64}`,
      buffer,
      hash,
    });
  }

  return mediaMap;
}

export function detectImageMimeType(buffer: Buffer, filename: string): string | null {
  if (!buffer || buffer.length < 4) return null;

  // Check magic bytes
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // SVG check: text starts with <svg or contains <svg
  if (filename.toLowerCase().endsWith('.svg')) {
    const textSnippet = buffer.slice(0, 1024).toString('utf-8').trim().toLowerCase();
    if (textSnippet.includes('<svg')) {
      return 'image/svg+xml';
    }
  }

  return null;
}
