# NutriForce backend — для деплоя на Timeweb Cloud Apps (или любой Docker-хостинг)
FROM node:20-alpine

WORKDIR /app

# Сначала только манифест — лучше кэшируется при ребилдах
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Healthcheck — Timeweb видит его в дашборде
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
