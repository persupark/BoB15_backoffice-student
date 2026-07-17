# build context = 리포 루트 (docker-compose.yml 참조)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/shared/package.json services/shared/
COPY services/photo/package.json services/photo/
RUN npm install --omit=dev --workspaces --include-workspace-root
COPY services/shared services/shared
COPY services/photo services/photo
EXPOSE 3002
CMD ["node", "services/photo/src/server.js"]
