FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY frontend/scripts frontend/scripts
RUN npm ci

COPY frontend frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm --workspace frontend run build

EXPOSE 3000
CMD ["npm", "--workspace", "frontend", "run", "start"]
