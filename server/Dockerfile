FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Basic deps + Blender deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip python3 python3-pip \
    libx11-6 libxi6 libxrender1 libxext6 libgl1 libglib2.0-0 \
    libsm6 libice6 \
    && rm -rf /var/lib/apt/lists/*

# Install Blender (headless)
# Note: For production, pin exact Blender version.
ARG BLENDER_VERSION=4.1.1
RUN curl -L -o /tmp/blender.tar.xz \
    https://download.blender.org/release/Blender4.1/blender-${BLENDER_VERSION}-linux-x64.tar.xz \
    && mkdir -p /opt \
    && tar -xf /tmp/blender.tar.xz -C /opt \
    && rm /tmp/blender.tar.xz

ENV BLENDER_PATH=/opt/blender-${BLENDER_VERSION}-linux-x64/blender

# Node
ARG NODE_MAJOR=20
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

# Build server TS -> JS
RUN npm run server:build

ENV PORT=8787
EXPOSE 8787

CMD ["node", ".server-dist/index.js"]
