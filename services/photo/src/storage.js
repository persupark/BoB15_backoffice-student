import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

/**
 * Storage 어댑터 — LocalDiskStorage. 동일 시그니처로 S3 등 외부 스토리지 구현으로 교체 가능.
 */
export class LocalDiskStorage {
  constructor(dir) {
    this.dir = dir;
  }

  async save(buffer, ext) {
    await mkdir(this.dir, { recursive: true });
    const name = `${crypto.randomUUID()}${ext}`;
    await writeFile(path.join(this.dir, name), buffer);
    return name;
  }

  async read(name) {
    return readFile(path.join(this.dir, safeName(name)));
  }

  async remove(name) {
    try {
      await unlink(path.join(this.dir, safeName(name)));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

// 경로 조작 방지: 파일명 이외의 경로 요소 제거
function safeName(name) {
  return path.basename(name);
}

/**
 * ScanHook — 기본은 no-op(통과). 동일 시그니처로 백신 스캔(ClamAV 등) 연동 가능.
 */
export const noopScanHook = async () => ({ clean: true, scanner: 'noop' });
