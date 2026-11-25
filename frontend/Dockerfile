FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build/client/ /usr/share/nginx/html/
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80