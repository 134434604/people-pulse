FROM node:22.18.0-bookworm-slim@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e AS build

WORKDIR /workspace/slack-app
COPY slack-app/package.json slack-app/package-lock.json ./
RUN npm ci --ignore-scripts
COPY slack-app/tsconfig.json ./
COPY slack-app/src ./src
RUN npm run build

FROM node:22.18.0-bookworm-slim@sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e AS runtime

ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY slack-app/package.json slack-app/package-lock.json ./slack-app/
RUN cd slack-app && npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /workspace/slack-app/dist ./slack-app/dist
COPY people-pulse/prototype/dept-insights-prototype.html ./people-pulse/prototype/dept-insights-prototype.html

USER node
EXPOSE 8080
CMD ["node", "slack-app/dist/peoplePulse/cloudRun.js"]
