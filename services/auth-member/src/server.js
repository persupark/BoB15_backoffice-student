import { createPool, createRedisClient } from '@boblog/shared';
import { createAuthApp } from './app.js';

const pool = createPool();
const redisClient = await createRedisClient();

const app = createAuthApp({
  pool,
  redisClient,
  config: {
    masterKeyB64: process.env.MASTER_KEY_B64,
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
    idleMinutes: Number(process.env.SESSION_IDLE_MINUTES || 30),
    serviceToken: process.env.SERVICE_TOKEN,
    photoBaseUrl: process.env.PHOTO_BASE_URL || 'http://localhost:3002',
    lockout: {
      maxFails: Number(process.env.LOGIN_MAX_FAILS || 5),
      lockMinutes: Number(process.env.LOCK_MINUTES || 30),
    },
  },
});

const port = Number(process.env.AUTH_PORT || 3001);
app.listen(port, () => console.log(`auth-member (boblog 웹) on :${port}`));
