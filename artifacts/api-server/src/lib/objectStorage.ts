/**
 * objectStorage.ts
 *
 * Multi-provider object storage abstraction.
 *
 * Set STORAGE_PROVIDER env var to choose a backend:
 *   - "replit"  (default) — Replit managed GCS via the local sidecar
 *   - "r2"                — Cloudflare R2 (S3-compatible)
 *   - "local"             — Local filesystem (for self-hosting without cloud storage)
 *
 * R2 env vars (required when STORAGE_PROVIDER=r2):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   Optional: R2_CUSTOM_DOMAIN (e.g. "https://assets.example.com")
 *
 * Local env vars (optional, STORAGE_PROVIDER=local):
 *   LOCAL_STORAGE_PATH  — root directory for stored files (default: "./local-storage")
 *   SERVER_BASE_URL     — base URL of the API server (default: http://localhost:{PORT}/api)
 *                         Used to generate local upload URLs.
 */

import { Readable, PassThrough } from "stream";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// ─── Abstract file interface ───────────────────────────────────────────────────

export interface StorageFileMetadata {
  contentType?: string;
  size?: number | string;
  metadata?: Record<string, string | undefined>;
}

export interface AbstractStorageFile {
  readonly name: string;
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[StorageFileMetadata]>;
  setMetadata(options: { metadata: Record<string, string | null> }): Promise<void>;
  createReadStream(): NodeJS.ReadableStream;
  download(): Promise<[Buffer]>;
}

// ─── Provider interface ───────────────────────────────────────────────────────

interface StorageProvider {
  getFile(bucketName: string, objectName: string): AbstractStorageFile;
  signUploadURL(bucketName: string, objectName: string, ttlSec: number): Promise<string>;
  normalizeUploadURL(uploadURL: string, privateObjectDir: string): string;
}

// ─── Shared errors ─────────────────────────────────────────────────────────────

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Replit GCS provider (default)
// ═══════════════════════════════════════════════════════════════════════════════

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

class ReplitGCSFile implements AbstractStorageFile {
  constructor(
    private readonly bucket: import("@google-cloud/storage").Bucket,
    private readonly file: import("@google-cloud/storage").File,
  ) {}

  get name(): string {
    return this.file.name;
  }

  async exists(): Promise<[boolean]> {
    return this.file.exists();
  }

  async getMetadata(): Promise<[StorageFileMetadata]> {
    const [meta] = await this.file.getMetadata();
    return [
      {
        contentType: meta.contentType as string | undefined,
        size: meta.size as string | undefined,
        metadata: meta.metadata as Record<string, string | undefined> | undefined,
      },
    ];
  }

  async setMetadata(options: {
    metadata: Record<string, string | null>;
  }): Promise<void> {
    await this.file.setMetadata({ metadata: options.metadata });
  }

  createReadStream(): NodeJS.ReadableStream {
    return this.file.createReadStream();
  }

  async download(): Promise<[Buffer]> {
    const [contents] = await this.file.download();
    return [Buffer.isBuffer(contents) ? contents : Buffer.from(contents)];
  }
}

class ReplitGCSProvider implements StorageProvider {
  private client: import("@google-cloud/storage").Storage;

  constructor() {
    const { Storage } = require("@google-cloud/storage");
    this.client = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  getFile(bucketName: string, objectName: string): AbstractStorageFile {
    const bucket = this.client.bucket(bucketName);
    return new ReplitGCSFile(bucket, bucket.file(objectName));
  }

  async signUploadURL(
    bucketName: string,
    objectName: string,
    ttlSec: number,
  ): Promise<string> {
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to sign object URL (status ${response.status}). ` +
          `Ensure this app is running on Replit.`,
      );
    }
    const { signed_url } = (await response.json()) as { signed_url: string };
    return signed_url;
  }

  normalizeUploadURL(uploadURL: string, privateObjectDir: string): string {
    if (!uploadURL.startsWith("https://storage.googleapis.com/")) {
      return uploadURL;
    }
    const url = new URL(uploadURL);
    const rawObjectPath = url.pathname;
    let objectEntityDir = privateObjectDir.endsWith("/")
      ? privateObjectDir
      : `${privateObjectDir}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cloudflare R2 provider (S3-compatible)
// ═══════════════════════════════════════════════════════════════════════════════

class R2File implements AbstractStorageFile {
  private _cachedHead: import("@aws-sdk/client-s3").HeadObjectCommandOutput | null = null;

  constructor(
    private readonly s3: import("@aws-sdk/client-s3").S3Client,
    private readonly bucket: string,
    readonly name: string,
  ) {}

  async exists(): Promise<[boolean]> {
    try {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }),
      );
      return [true];
    } catch {
      return [false];
    }
  }

  private async _head(): Promise<
    import("@aws-sdk/client-s3").HeadObjectCommandOutput
  > {
    if (!this._cachedHead) {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      this._cachedHead = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.name }),
      );
    }
    return this._cachedHead;
  }

  async getMetadata(): Promise<[StorageFileMetadata]> {
    const head = await this._head();
    return [
      {
        contentType: head.ContentType,
        size: head.ContentLength,
        metadata: head.Metadata as Record<string, string | undefined> | undefined,
      },
    ];
  }

  async setMetadata(options: {
    metadata: Record<string, string | null>;
  }): Promise<void> {
    const { CopyObjectCommand } = await import("@aws-sdk/client-s3");
    const head = await this._head();
    const existing: Record<string, string> = { ...(head.Metadata ?? {}) };
    for (const [k, v] of Object.entries(options.metadata)) {
      if (v === null) {
        delete existing[k];
      } else {
        existing[k] = v;
      }
    }
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${this.name}`,
        Key: this.name,
        Metadata: existing,
        MetadataDirective: "REPLACE",
        ContentType: head.ContentType,
      }),
    );
    this._cachedHead = null;
  }

  createReadStream(): NodeJS.ReadableStream {
    const pass = new PassThrough();
    (async () => {
      try {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const response = await this.s3.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: this.name }),
        );
        if (response.Body) {
          (response.Body as unknown as NodeJS.ReadableStream).pipe(pass);
        } else {
          pass.end();
        }
      } catch (err) {
        pass.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    })();
    return pass;
  }

  async download(): Promise<[Buffer]> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.name }),
    );
    if (!response.Body) {
      throw new Error(`Empty body for R2 object: ${this.name}`);
    }
    const bytes = await (
      response.Body as unknown as { transformToByteArray(): Promise<Uint8Array> }
    ).transformToByteArray();
    return [Buffer.from(bytes)];
  }
}

class R2Provider implements StorageProvider {
  private s3!: import("@aws-sdk/client-s3").S3Client;
  private r2Bucket: string;
  private accountId: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        "Cloudflare R2 storage provider requires the following env vars: " +
          "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME",
      );
    }

    this.accountId = accountId;
    this.r2Bucket = bucket;

    const { S3Client } = require("@aws-sdk/client-s3");
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  getFile(_bucketAlias: string, objectName: string): AbstractStorageFile {
    return new R2File(this.s3, this.r2Bucket, objectName);
  }

  async signUploadURL(
    _bucketAlias: string,
    objectName: string,
    ttlSec: number,
  ): Promise<string> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.r2Bucket, Key: objectName }),
      { expiresIn: ttlSec },
    );
  }

  normalizeUploadURL(uploadURL: string, privateObjectDir: string): string {
    const r2Host = `${this.accountId}.r2.cloudflarestorage.com`;
    if (!uploadURL.includes(r2Host)) {
      return uploadURL;
    }
    const url = new URL(uploadURL);
    const rawPathname = url.pathname;
    const bucketPrefix = `/${this.r2Bucket}/`;
    if (!rawPathname.startsWith(bucketPrefix)) {
      return rawPathname;
    }
    const objectName = rawPathname.slice(bucketPrefix.length);
    const { objectName: privateDirObjectName } = parseObjectPath(privateObjectDir);
    const prefix = privateDirObjectName.endsWith("/")
      ? privateDirObjectName
      : `${privateDirObjectName}/`;
    if (!objectName.startsWith(prefix)) {
      return `/${objectName}`;
    }
    const entityId = objectName.slice(prefix.length);
    return `/objects/${entityId}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Local filesystem provider (self-hosting without cloud storage)
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalMeta {
  contentType?: string;
  size?: number;
  metadata?: Record<string, string>;
}

export class LocalFSFile implements AbstractStorageFile {
  readonly filePath: string;
  private readonly metaPath: string;

  constructor(
    readonly name: string,
    storageRoot: string,
  ) {
    this.filePath = path.join(storageRoot, name);
    this.metaPath = `${this.filePath}.meta.json`;
  }

  async exists(): Promise<[boolean]> {
    return [fs.existsSync(this.filePath)];
  }

  private _readMeta(): LocalMeta {
    if (fs.existsSync(this.metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.metaPath, "utf8"));
      } catch {
        return {};
      }
    }
    return {};
  }

  private _writeMeta(meta: LocalMeta): void {
    fs.mkdirSync(path.dirname(this.metaPath), { recursive: true });
    fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2), "utf8");
  }

  async getMetadata(): Promise<[StorageFileMetadata]> {
    const meta = this._readMeta();
    return [
      {
        contentType: meta.contentType,
        size: meta.size,
        metadata: meta.metadata as Record<string, string | undefined> | undefined,
      },
    ];
  }

  async setMetadata(options: {
    metadata: Record<string, string | null>;
  }): Promise<void> {
    const meta = this._readMeta();
    const existing: Record<string, string> = { ...(meta.metadata ?? {}) };
    for (const [k, v] of Object.entries(options.metadata)) {
      if (v === null) {
        delete existing[k];
      } else {
        existing[k] = v;
      }
    }
    meta.metadata = existing;
    this._writeMeta(meta);
  }

  createReadStream(): NodeJS.ReadableStream {
    return fs.createReadStream(this.filePath);
  }

  async download(): Promise<[Buffer]> {
    return [fs.readFileSync(this.filePath)];
  }

  save(data: Buffer, contentType?: string): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, data);
    const meta = this._readMeta();
    meta.size = data.length;
    if (contentType) meta.contentType = contentType;
    this._writeMeta(meta);
  }
}

const LOCAL_UPLOAD_TOKENS = new Map<
  string,
  { objectName: string; expires: number }
>();

class LocalFSProvider implements StorageProvider {
  private storageRoot: string;

  constructor() {
    this.storageRoot = process.env.LOCAL_STORAGE_PATH || "./local-storage";
  }

  getFile(_bucketAlias: string, objectName: string): AbstractStorageFile {
    return new LocalFSFile(objectName, this.storageRoot);
  }

  async signUploadURL(
    _bucketAlias: string,
    objectName: string,
    ttlSec: number,
  ): Promise<string> {
    const token = randomUUID();
    LOCAL_UPLOAD_TOKENS.set(token, {
      objectName,
      expires: Date.now() + ttlSec * 1000,
    });
    const baseUrl = (
      process.env.SERVER_BASE_URL?.replace(/\/+$/, "") ??
      `http://localhost:${process.env.PORT ?? 5000}/api`
    );
    return `${baseUrl}/storage/local-upload/${token}`;
  }

  normalizeUploadURL(uploadURL: string, privateObjectDir: string): string {
    const marker = "/storage/local-upload/";
    const idx = uploadURL.indexOf(marker);
    if (idx === -1) return uploadURL;

    const token = uploadURL.slice(idx + marker.length);
    const entry = LOCAL_UPLOAD_TOKENS.get(token);
    if (!entry) return uploadURL;

    const objectName = entry.objectName;
    const { objectName: privateDirObjectName } = parseObjectPath(privateObjectDir);
    const prefix = privateDirObjectName.endsWith("/")
      ? privateDirObjectName
      : `${privateDirObjectName}/`;
    if (!objectName.startsWith(prefix)) {
      return `/${objectName}`;
    }
    const entityId = objectName.slice(prefix.length);
    return `/objects/${entityId}`;
  }
}

export { LOCAL_UPLOAD_TOKENS, LocalFSProvider };

// ─── Provider factory ─────────────────────────────────────────────────────────

let _provider: StorageProvider | null = null;

function getProvider(): StorageProvider {
  if (_provider) return _provider;
  const type = (process.env.STORAGE_PROVIDER ?? "replit").toLowerCase();
  if (type === "r2") {
    _provider = new R2Provider();
  } else if (type === "local") {
    _provider = new LocalFSProvider();
  } else {
    _provider = new ReplitGCSProvider();
  }
  return _provider;
}

// ─── Shared path helpers ──────────────────────────────────────────────────────

export function parseObjectPath(fullPath: string): {
  bucketName: string;
  objectName: string;
} {
  let p = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = p.split("/").filter((_, i) => i > 0 || p.startsWith("/"));
  const segments = p.slice(1).split("/");
  if (segments.length < 2) {
    throw new Error(
      `Invalid object path "${fullPath}": must have at least /bucket/name`,
    );
  }
  const bucketName = segments[0];
  const objectName = segments.slice(1).join("/");
  return { bucketName, objectName };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ObjectStorageService — public API (unchanged surface, multi-provider backend)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export class ObjectStorageService {
  private get provider(): StorageProvider {
    return getProvider();
  }

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. " +
          "Set this env var to a comma-separated list of object paths.",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR ?? "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. " +
          "Set this env var to the path prefix for private uploads.",
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<AbstractStorageFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const file = this.provider.getFile(bucketName, objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(
    file: AbstractStorageFile,
    cacheTtlSec = 3600,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream as Readable) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type":
        metadata.contentType ?? "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size != null) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return this.provider.signUploadURL(bucketName, objectName, 900);
  }

  async getObjectEntityFile(objectPath: string): Promise<AbstractStorageFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();

    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;

    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);

    const file = this.provider.getFile(bucketName, objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    return this.provider.normalizeUploadURL(rawPath, this.getPrivateObjectDir());
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: AbstractStorageFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
