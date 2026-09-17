import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { HttpError } from '../middlewares/errorHandler';

const DATA_URI_PATTERN = /^data:(?<mime>[-\w.+/]+);base64,(?<base64>[A-Za-z0-9+/=\s]+)$/i;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_CATEGORY = 'general';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const sanitizeCategory = (value?: string | null): string => {
  if (!value) return DEFAULT_CATEGORY;
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return sanitized || DEFAULT_CATEGORY;
};

const getUploadsRootDirectory = (): string => path.resolve(__dirname, '..', '..', 'uploads');

const parseDataUri = (dataUri: string): { mime: string; base64: string } => {
  const match = dataUri.trim().match(DATA_URI_PATTERN);
  const mime = match?.groups?.mime?.toLowerCase();
  const base64 = match?.groups?.base64?.replace(/\s+/g, '');
  if (!mime || !base64) {
    throw new HttpError('Invalid upload payload. Expected base64 data URI.', 400);
  }
  if (!(mime in MIME_EXTENSION_MAP)) {
    throw new HttpError('Unsupported image format. Use JPEG, PNG, WEBP, HEIC, or HEIF.', 400);
  }
  return { mime, base64 };
};

export const getUploadsDirectory = (): string => getUploadsRootDirectory();

export const persistDataUriUpload = async (input: {
  dataUri: string;
  category?: string | null;
  userId: string;
}): Promise<{ relativeUrl: string; mimeType: string; sizeBytes: number }> => {
  const parsed = parseDataUri(input.dataUri);
  const extension = MIME_EXTENSION_MAP[parsed.mime];
  const bytes = Buffer.from(parsed.base64, 'base64');

  if (bytes.length === 0) {
    throw new HttpError('Upload payload is empty.', 400);
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new HttpError('Image is too large. Maximum size is 4 MB.', 413);
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const category = sanitizeCategory(input.category);
  const safeUserId = input.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'anon';

  const relativeDirectory = path.posix.join(category, year, month);
  const absoluteDirectory = path.join(getUploadsRootDirectory(), category, year, month);
  const fileName = `${Date.now()}-${safeUserId}-${randomUUID().slice(0, 8)}.${extension}`;
  const absolutePath = path.join(absoluteDirectory, fileName);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, bytes);

  return {
    relativeUrl: `/uploads/${relativeDirectory}/${fileName}`,
    mimeType: parsed.mime,
    sizeBytes: bytes.length,
  };
};
