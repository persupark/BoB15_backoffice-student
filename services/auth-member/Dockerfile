# build context = 리포 루트 (docker-compose.yml 참조)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/shared/package.json services/shared/
COPY services/auth-member/package.json services/auth-member/
RUN npm install --omit=dev --workspaces --include-workspace-root
COPY services/shared services/shared
COPY services/auth-member services/auth-member
EXPOSE 3001
CMD ["node", "services/auth-member/src/server.js"]
