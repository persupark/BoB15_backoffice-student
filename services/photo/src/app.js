import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { LocalAesGcmProvider } from '@boblog/shared';
import { LocalDiskStorage, noopScanHook } from './storage.js';

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

/**
 * photo 서비스 — 내부 전용 API (auth-member가 BFF로 호출).
 * 모든 요청은 x-service-token 검증. 위치정보는 회원 DEK로 암호화 저장(제7조).
 */
export function createPhotoApp({ pool, config }) {
  const app = express();
  const crypto = new LocalAesGcmProvider(config.masterKeyB64);
  const storage = new LocalDiskStorage(config.uploadDir);
  const scanHook = config.scanHook ?? noopScanHook;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
  });

  // 헬스체크는 개인정보를 노출하지 않으므로 서비스 인증 앞에 둔다(컨테이너 healthcheck용).
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.use((req, res, next) => {
    if (req.headers['x-service-token'] !== config.serviceToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  });

  app.post('/internal/photos', upload.single('photo'), async (req, res, next) => {
    try {
      const memberId = Number(req.body.member_id);
      if (!memberId || !req.file) {
        return res.status(400).json({ error: 'member_id와 이미지 파일(jpg/png/webp/gif, 5MB 이하)이 필요합니다' });
      }

      const scan = await scanHook(req.file.buffer, req.file.originalname);
      if (!scan.clean) return res.status(422).json({ error: 'malicious file rejected', scanner: scan.scanner });

      const { rows } = await pool.query(
        `SELECT dek_wrapped FROM app.members WHERE id = $1 AND status = 'active'`, [memberId]);
      if (!rows.length) return res.status(404).json({ error: 'member not found' });

      let locEnc = null;
      const { lat, lng } = req.body;
      if (lat && lng) {
        const dek = crypto.unwrapDek(rows[0].dek_wrapped);
        locEnc = crypto.encryptField(dek, `${lat},${lng}`);
      }

      const ext = ALLOWED.get(req.file.mimetype) ?? path.extname(req.file.originalname);
      const filePath = await storage.save(req.file.buffer, ext);
      const inserted = await pool.query(
        `INSERT INTO app.photos (member_id, file_path, caption, loc_enc)
         VALUES ($1,$2,$3,$4) RETURNING id, file_path, caption, taken_at`,
        [memberId, filePath, req.body.caption ?? null, locEnc],
      );
      res.status(201).json(inserted.rows[0]);
    } catch (e) {
      next(e);
    }
  });

  app.get('/internal/photos', async (req, res, next) => {
    try {
      const memberId = Number(req.query.member_id);
      if (!memberId) return res.status(400).json({ error: 'member_id required' });
      const { rows } = await pool.query(
        `SELECT id, file_path, caption, taken_at, (loc_enc IS NOT NULL) AS has_location
           FROM app.photos WHERE member_id = $1 ORDER BY taken_at DESC LIMIT 50`,
        [memberId],
      );
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  app.get('/internal/photos/:id/file', async (req, res, next) => {
    try {
      const memberId = Number(req.query.member_id);
      const { rows } = await pool.query(
        `SELECT file_path FROM app.photos WHERE id = $1 AND member_id = $2`,
        [Number(req.params.id), memberId],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      const buf = await storage.read(rows[0].file_path);
      res.type(path.extname(rows[0].file_path)).send(buf);
    } catch (e) {
      next(e);
    }
  });

  // 파기(제13조) 지원: 회원의 사진 파일·메타데이터 일괄 삭제 (backoffice가 호출)
  app.delete('/internal/members/:memberId/photos', async (req, res, next) => {
    try {
      const memberId = Number(req.params.memberId);
      const { rows } = await pool.query(
        `DELETE FROM app.photos WHERE member_id = $1 RETURNING file_path`, [memberId]);
      await Promise.all(rows.map((r) => storage.remove(r.file_path)));
      res.json({ deleted: rows.length });
    } catch (e) {
      next(e);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('photo:', err.message);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}
