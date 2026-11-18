# Node 24+ runs the TypeScript server directly (native type stripping), so only the client needs a build.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "src/server/index.ts"]
