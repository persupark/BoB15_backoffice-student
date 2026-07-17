import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

export async function createRedisClient(url = process.env.REDIS_URL || 'redis://localhost:6379') {
  const client = createClient({ url });
  client.on('error', (e) => console.error('redis:', e.message));
  await client.connect();
  return client;
}

/**
 * 세션 통제 (제6조): 유휴 타임아웃(rolling) — SESSION_IDLE_MINUTES 동안 요청이 없으면 만료.
 * httpOnly + sameSite=lax 쿠키, Redis 저장(서비스별 prefix 분리).
 */
export function createSessionMiddleware({ redisClient, name, secret, idleMinutes = 30 }) {
  return session({
    store: new RedisStore({ client: redisClient, prefix: `sess:${name}:` }),
    name,
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: idleMinutes * 60 * 1000,
    },
  });
}
