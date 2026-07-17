import { createPool, createRedisClient } from '@boblog/shared';
import { createVulnApp } from './app.js';

const pool = createPool();
const redisClient = await createRedisClient();

const app = createVulnApp({
  pool,
  redisClient,
  config: {
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  },
});

const port = Number(process.env.VULN_PORT || 3200);
app.listen(port, () =>
  console.log(`backoffice-vuln (진단 대상: 보호조치 미적용) on :${port}`));
