import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false, // 해시체인 advisory lock·공유 DB 사용으로 파일 순차 실행
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
