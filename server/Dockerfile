FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# 1. 安裝系統基礎套件與 Blender 依賴
# 加入 xz-utils (解壓用) 以及 libxkbcommon0 (Blender 執行必備)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    xz-utils \
    python3 \
    python3-pip \
    libx11-6 \
    libxi6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libice6 \
    libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

# 2. 下載並安裝 Blender (Headless)
ARG BLENDER_VERSION=4.1.1
RUN curl -L -o /tmp/blender.tar.xz \
    https://download.blender.org/release/Blender4.1/blender-${BLENDER_VERSION}-linux-x64.tar.xz \
    && mkdir -p /opt \
    && tar -xf /tmp/blender.tar.xz -C /opt \
    && rm /tmp/blender.tar.xz

ENV BLENDER_PATH=/opt/blender-${BLENDER_VERSION}-linux-x64/blender

# 3. 安裝 Node.js (版本 20)
ARG NODE_MAJOR=20
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 4. 安裝專案依賴
# 先安裝所有依賴 (包含開發用的 typescript/tsc)，確保能順利編譯
COPY package.json package-lock.json ./
RUN npm install

# 5. 複製後端程式碼並編譯
COPY server ./server
RUN npm run server:build

# 6. 設定運行環境
ENV PORT=8787
EXPOSE 8787

# 啟動編譯後的伺服器
CMD ["node", ".server-dist/index.js"]
