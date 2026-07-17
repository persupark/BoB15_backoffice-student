import { createPool } from '@boblog/shared';
import { createPhotoApp } from './app.js';

const pool = createPool();
const app = createPhotoApp({
  pool,
  config: {
    masterKeyB64: process.env.MASTER_KEY_B64,
    serviceToken: process.env.SERVICE_TOKEN,
    uploadDir: process.env.UPLOAD_DIR || './data/uploads',
  },
});

const port = Number(process.env.PHOTO_PORT || 3002);
app.listen(port, () => console.log(`photo service on :${port}`));
