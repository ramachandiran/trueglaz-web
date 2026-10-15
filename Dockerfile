# Build the single-page app, then serve it with nginx which also reverse-proxies
# the API — so the browser only ever makes same-origin requests and CORS never
# enters into it. Used by the single-box deploy in trueglaz-api/deploy/allinone.
FROM node:22-slim AS build
WORKDIR /app
COPY . .
# VITE_API_ORIGIN is deliberately NOT set: the client then calls /api/v1 as a
# relative path, which nginx (below) proxies to the API on the same origin.
#
# --ignore-scripts: the workspace also holds the Expo/React-Native mobile app,
# whose native dependencies run postinstall steps that need native toolchains
# and fail in this slim image. The web (Vite) build needs none of those scripts
# — @trueglaz/core is consumed as TypeScript source — so skipping them keeps the
# build reliable without changing the output.
RUN npm ci --ignore-scripts && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
