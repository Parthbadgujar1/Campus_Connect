import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { auditBestEffort } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import type { Deps } from '../../deps.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { FileDoc, FileKind } from '../../infra/db/models.js';
import type { AuthContext } from '../../types/fastify.js';
import { detect, PURPOSES, safeName, type Purpose } from './file-policy.js';

// Upload pipeline: size limit -> type from bytes -> image clean-up -> checksum -> malware scan
// -> object storage -> database record. Each step fails with a clear error and leaves nothing
// half-written behind: the record is created first as "pending" and only marked "ready" once
// the bytes are safely stored (and scanned, when a scanner is configured).

const MAX_IMAGE_PIXELS = 40_000_000; // ~ 7700 x 5200; refuses decompression bombs

export interface FileView {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: FileKind;
  status: string;
  width: number | null;
  height: number | null;
  url: string | null;
  thumbnailUrl: string | null;
}

const signable = (f: FileDoc) => ({ id: f._id, storageKey: f.storageKey, originalName: f.originalName, mimeType: f.mimeType });

/** Shapes a file for API responses, with short-lived signed links (only when ready). */
export async function fileView(deps: Deps, f: FileDoc, expiresSeconds = 3600): Promise<FileView> {
  const ready = f.status === 'ready';
  return {
    id: f._id,
    name: f.originalName,
    mimeType: f.mimeType,
    size: Number(f.sizeBytes),
    kind: f.kind,
    status: f.status,
    width: f.width,
    height: f.height,
    url: ready ? await deps.storage.signedUrl(signable(f), 'original', expiresSeconds) : null,
    thumbnailUrl: ready && f.hasThumbnail ? await deps.storage.signedUrl(signable(f), 'thumb', expiresSeconds) : null,
  };
}

/** Loads files by id for embedding in other responses (posts, messages, listings...). */
export async function loadFileViews(deps: Deps, ids: Array<string | null | undefined>): Promise<Map<string, FileView>> {
  const out = new Map<string, FileView>();
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return out;
  const rows = await deps.db.col('files').find({ _id: { $in: unique }, deletedAt: null }).toArray();
  await Promise.all(rows.map(async (r) => out.set(r._id, await fileView(deps, r))));
  return out;
}

export async function loadFile(deps: Deps, id: string | null | undefined): Promise<FileDoc | null> {
  if (!id) return null;
  return deps.db.col('files').findOne({ _id: id, deletedAt: null });
}

/** Checks that files were uploaded by this person for this purpose and are usable. */
export async function assertOwnFiles(deps: Deps, userId: string, ids: string[], purposes: Purpose[], kinds?: FileKind[]): Promise<void> {
  if (!ids.length) return;
  const unique = [...new Set(ids)];
  const count = await deps.db.col('files').countDocuments({
    _id: { $in: unique },
    ownerId: userId,
    purpose: { $in: purposes },
    status: { $in: ['ready', 'pending'] },
    deletedAt: null,
    ...(kinds ? { kind: { $in: kinds } } : {}),
  });
  if (count !== unique.length) {
    throw Errors.validation([{ field: 'attachments', message: 'One of the files is missing or cannot be used here. Upload it again.' }]);
  }
}

async function processImage(buffer: Buffer, mime: string): Promise<{ body: Buffer; width?: number; height?: number; thumb?: Buffer }> {
  try {
    const input = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error', animated: mime === 'image/gif' });
    const meta = await input.metadata();
    let body = buffer;
    // Re-encoding drops EXIF metadata, including the GPS location phones embed in photos.
    if (mime === 'image/jpeg') body = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    else if (mime === 'image/png') body = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate().png().toBuffer();
    else if (mime === 'image/webp') body = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate().webp({ quality: 88 }).toBuffer();
    const thumb = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate().resize(480, 480, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
    const portrait = meta.orientation && meta.orientation >= 5;
    return { body, width: portrait ? meta.height : meta.width, height: portrait ? meta.width : meta.height, thumb };
  } catch (err) {
    const message = (err as Error).message ?? '';
    if (/pixel limit/i.test(message)) throw Errors.unprocessable('This image is too large in dimensions. Resize it below 40 megapixels.');
    throw Errors.unprocessable('This image could not be read. It may be damaged; try exporting it again as JPEG or PNG.');
  }
}

export async function storeUpload(
  deps: Deps,
  input: { auth: Pick<AuthContext, 'userId' | 'collegeId'>; purpose: Purpose; filename: string; buffer: Buffer; requestId: string; ipHash: string | null },
): Promise<FileView> {
  const rule = PURPOSES[input.purpose];
  const max = rule.maxBytes(deps.config.storage.maxUploadBytes);
  if (input.buffer.length === 0) throw Errors.badRequest('The file is empty.');
  if (input.buffer.length > max) throw Errors.tooLarge(`This file is too large. The limit here is ${Math.round(max / 1024 / 1024)} MB.`);

  const name = safeName(input.filename);
  const detected = await detect(input.buffer, name);
  if (!detected) throw Errors.unsupportedMedia('This file type is not supported. Use images, PDFs, Office documents, audio, video or ZIP.');
  if (!rule.kinds.includes(detected.kind)) {
    throw Errors.unsupportedMedia(`${detected.kind[0]!.toUpperCase()}${detected.kind.slice(1)} files cannot be used here. Allowed: ${rule.kinds.join(', ')}.`);
  }

  let body = input.buffer;
  let width: number | undefined;
  let height: number | undefined;
  let thumb: Buffer | undefined;
  if (detected.kind === 'image') ({ body, width, height, thumb } = await processImage(input.buffer, detected.mime));

  const scan = await deps.scanner.scan(body);
  if (scan.status === 'infected') {
    await auditBestEffort(deps.db, { action: 'file.rejected_malware', actorId: input.auth.userId, collegeId: input.auth.collegeId, ipHash: input.ipHash, requestId: input.requestId, meta: { signature: scan.signature, name } }, deps.logger);
    throw Errors.unprocessable('This file was blocked because it looks unsafe.');
  }
  // Scanner configured but unreachable: keep the file pending (not downloadable) and retry later.
  const status: FileDoc['status'] = scan.status === 'clean' ? 'ready' : 'pending';

  const id = uuidv7();
  const now = new Date();
  const key = `${input.auth.collegeId}/${input.purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}`;
  const doc: FileDoc = {
    _id: id,
    collegeId: input.auth.collegeId,
    ownerId: input.auth.userId,
    purpose: input.purpose,
    visibility: rule.visibility,
    storageDriver: deps.storage.driverName,
    storageKey: key,
    originalName: name,
    mimeType: detected.mime,
    sizeBytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    kind: detected.kind,
    status: 'pending',
    width: width ?? null,
    height: height ?? null,
    hasThumbnail: Boolean(thumb),
    scanResult: scan.status === 'clean' ? (deps.scanner.enabled ? 'clean' : 'not_scanned') : `retry: ${scan.error}`.slice(0, 200),
    expiresAt: null,
    createdAt: now,
    deletedAt: null,
  };
  const files = deps.db.col('files');
  await files.insertOne(doc);
  try {
    await deps.storage.put(key, body, detected.mime);
    if (thumb) await deps.storage.put(`${key}.thumb.webp`, thumb, 'image/webp');
  } catch (err) {
    // Leave no orphan record behind if the bytes could not be stored.
    await files.updateOne({ _id: id }, { $set: { status: 'deleted', deletedAt: new Date() } }).catch(() => undefined);
    throw err;
  }
  await files.updateOne({ _id: id }, { $set: { status } });
  return fileView(deps, { ...doc, status });
}
