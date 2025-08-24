#!/bin/bash

NETWORK_NAME="hydra-network"

# Kiểm tra network đã tồn tại chưa
if docker network ls --format '{{.Name}}' | grep -w "$NETWORK_NAME" > /dev/null 2>&1; then
    echo "✅ Docker network '$NETWORK_NAME' đã tồn tại."
else
    echo "ℹ️  Docker network '$NETWORK_NAME' chưa tồn tại. Đang tạo mới..."
    docker network create "$NETWORK_NAME"
    if [ $? -eq 0 ]; then
        echo "✅ Tạo network '$NETWORK_NAME' thành công."
    else
        echo "❌ Lỗi khi tạo network '$NETWORK_NAME'."
        exit 1
    fi
fi
