FROM node:20-alpine

# System deps for @napi-rs/canvas
RUN apk add --no-cache \
    cairo-dev pango-dev giflib-dev pixman-dev \
    build-base python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Environment passed by Railway
ENV NODE_ENV=production

# The bot is not an HTTP server; just run the process
CMD ["npm", "start"]


