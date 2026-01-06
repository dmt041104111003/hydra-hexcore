# Hướng dẫn cài đặt Hydra Hexcore

## Yêu cầu hệ thống

- **Docker** >= 24.0 (với Docker Compose plugin)
- **WSL2** (nếu dùng Windows)
- **RAM**: Tối thiểu 8GB (khuyến nghị 16GB)
- **Disk**: Tối thiểu 50GB trống (Cardano Node cần ~40GB cho preprod)

## Các bước cài đặt

### Bước 1: Clone repository

```bash
git clone <repository-url>
cd hydra-hexcore
```

### Bước 2: Chạy Docker Compose

```bash
# Chạy tất cả services
docker compose -f docker-compose.local.yml up -d --build

# Kiểm tra trạng thái
docker ps
```

### Bước 3: Đợi Cardano Node sync

Cardano Node cần **3-8 giờ** để sync toàn bộ preprod blockchain.

```bash
# Xem tiến trình sync
docker logs -f cardano-node

# Khi thấy logs như này là đang sync:
# [cardano.node.ChainDB:Notice] Chain extended, new tip at slot 12345678
```

#### Kiểm tra tiến độ sync

**Cách 1: Không cần cài thêm gì**

```bash
# Xem raw JSON
curl -s http://localhost:1337/health

# Tìm networkSynchronization trong output
curl -s http://localhost:1337/health | grep -o '"networkSynchronization":[0-9.]*'
```

**Cách 2: Dùng jq (dễ đọc hơn)**

```bash
# Cài jq (nếu chưa có)
sudo apt install jq -y

# Kiểm tra % sync (0.0 - 1.0)
curl -s http://localhost:1337/health | jq '.networkSynchronization'

# Xem % dễ đọc hơn
curl -s http://localhost:1337/health | jq '.networkSynchronization * 100'
```

**Ví dụ kết quả:**

```bash
$ curl -s http://localhost:1337/health | jq '.networkSynchronization'
0.12051   # ← 12% đã sync
```

**Giải thích:**
- `0.12` = 12% đã sync
- `0.50` = 50% đã sync  
- `1.0` = **100% - Sync xong!** ✅

#### Theo dõi tự động mỗi 30 giây

```bash
watch -n 30 'curl -s http://localhost:1337/health | jq ".networkSynchronization * 100 | floor" | xargs -I{} echo "{}% synced"'
```

#### Thời gian ước tính

| Network | Thời gian sync |
|---------|----------------|
| **Preprod** | 3-8 giờ |
| **Mainnet** | 24-72 giờ |

### Bước 4: Truy cập APIs

| Service | URL | Mô tả |
|---------|-----|-------|
| **Hexcore API** | http://localhost:3010 | API chính |
| **Swagger Docs** | http://localhost:3010/api-docs | API documentation |
| **Ogmios** | http://localhost:1337 | Cardano API |
| **Cardano Node** | localhost:8091 | Node RPC |

## Các lệnh hữu ích

```bash
# Xem logs của service cụ thể
docker logs -f cardano-node
docker logs -f hydra-hexcore
docker logs -f ogmios

# Dừng tất cả services
docker compose -f docker-compose.local.yml down

# Dừng và xóa data (cần sync lại từ đầu)
docker compose -f docker-compose.local.yml down -v

# Restart một service
docker restart cardano-node
docker restart hydra-hexcore
```

## Cấu trúc services

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Stack                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   MySQL     │  │   Redis     │  │   Cardano Node      │  │
│  │   :3306     │  │   :6379     │  │   :8091 (preprod)   │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
│                                               │              │
│  ┌─────────────────────────────┐  ┌──────────▼──────────┐  │
│  │     Hydra Hexcore API       │  │      Ogmios         │  │
│  │     http://localhost:3010   │  │   :1337             │  │
│  └─────────────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Cardano Node restart liên tục

```bash
# Xem lỗi
docker logs cardano-node --tail=50

# Thường do thiếu config hoặc hash không đúng
# Kiểm tra file configs/cardano/
```

### Hydra Hexcore không start

```bash
# Xem lỗi
docker logs hydra-hexcore --tail=50

# Rebuild image
docker compose -f docker-compose.local.yml up -d --build hydra-hexcore
```

### Xóa data và sync lại từ đầu

```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d --build
```

### Hexcore không kết nối được Ogmios

**Triệu chứng:**
```bash
curl http://localhost:3010/hydra-main/ogmios
# Trả về: {"statusCode":200,"message":"request to http://localhost:1337/health failed, reason: ""}
```

**Nguyên nhân:** Hexcore container đang dùng `localhost:1337` thay vì service name `ogmios:1337`.

**Cách fix:** Đảm bảo trong `docker-compose.local.yml` có các biến môi trường:

```yaml
hydra-hexcore:
  environment:
    # Ogmios - QUAN TRỌNG!
    NEST_OGMIOS_HOST: ogmios
    NEST_OGMIOS_PORT: 1337
```

Sau đó restart:
```bash
docker compose -f docker-compose.local.yml up -d --force-recreate hydra-hexcore
```

### Cardano Node lỗi GenesisHashMismatch

**Triệu chứng:**
```
CardanoProtocolInstantiationError (GenesisHashMismatch "hash1" "hash2")
cardano-node: Shelley related: Wrong genesis file
```

**Cách fix:** Cập nhật `ShelleyGenesisHash` trong `configs/cardano/config.json` với hash đúng (hash được hiển thị trong error message).

```json
{
  "ShelleyGenesisHash": "752efeeb3dd90ae69b0851f9f7cf832856441baa7490a65b0c98832fabce3124"
}
```

Sau đó restart:
```bash
docker restart cardano-node
```

## Lưu ý quan trọng

1. **Lần đầu chạy**: Cardano Node cần thời gian sync (3-8 giờ)
2. **Disk space**: Đảm bảo có đủ ~50GB disk trống
3. **RAM**: Nên có ít nhất 8GB RAM
4. **Network**: Cần kết nối internet ổn định để sync blockchain

## Data Sync - Khi nào cần sync lại?

### ✅ KHÔNG cần sync lại (data được giữ):

| Tình huống | Cần sync lại? |
|------------|---------------|
| Container restart | ❌ Không |
| Sửa lỗi config.json, topology.json | ❌ Không |
| Build lại hydra-hexcore | ❌ Không |
| `docker compose down` | ❌ Không |
| Máy tính restart | ❌ Không |

### ⚠️ PHẢI sync lại từ đầu:

| Tình huống | Cần sync lại? |
|------------|---------------|
| `docker compose down -v` (xóa volumes) | ✅ PHẢI sync lại |
| Xóa thủ công volume `cardano_db` | ✅ PHẢI sync lại |

### Lệnh an toàn (giữ data sync):

```bash
# Restart - AN TOÀN
docker compose -f docker-compose.local.yml restart

# Stop rồi start lại - AN TOÀN  
docker compose -f docker-compose.local.yml down
docker compose -f docker-compose.local.yml up -d

# Build lại app - AN TOÀN
docker compose -f docker-compose.local.yml up -d --build
```

### ⛔ Lệnh NGUY HIỂM (mất data sync):

```bash
# ⚠️ CẢNH BÁO: Lệnh này XÓA TẤT CẢ DATA, phải sync lại từ đầu!
docker compose -f docker-compose.local.yml down -v
```

> **Tip:** Blockchain data được lưu trong Docker volume `cardano_db`. Chỉ cần không xóa volume này thì data sync vẫn còn!

## Kiểm tra setup thành công

Sau khi sync xong, chạy các lệnh sau để verify:

```bash
# 1. Kiểm tra Cardano Node đã sync 100%
curl -s http://localhost:1337/health | jq '.networkSynchronization'
# Kết quả: 1

# 2. Kiểm tra Ogmios hoạt động
curl -s http://localhost:1337/health | jq '.currentEpoch'
# Kết quả: số epoch hiện tại (ví dụ: 217)

# 3. Kiểm tra Hexcore API
curl -s http://localhost:3010/health
# Kết quả: {"status":"ok"} hoặc tương tự

# 4. Xem Swagger API docs
# Mở browser: http://localhost:3010/api-docs
```

Nếu tất cả đều OK = **Setup hoàn tất!** 🎉

---

## 🚀 Quick Start - Chạy 1 phát

Copy và chạy toàn bộ block lệnh này:

```bash
# Clone repo
git clone <repository-url>
cd hydra-hexcore

# Cài jq để theo dõi sync (optional)
sudo apt install jq -y

# Chạy Docker stack
docker compose -f docker-compose.local.yml up -d --build

# Đợi 30 giây để services khởi động
echo "⏳ Đợi services khởi động..."
sleep 30

# Kiểm tra trạng thái
echo "📊 Trạng thái containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Kiểm tra sync progress
echo ""
echo "🔄 Sync progress:"
curl -s http://localhost:1337/health | jq '.networkSynchronization * 100 | floor' | xargs -I{} echo "{}% synced"

# Kiểm tra Hexcore API
echo ""
echo "🌐 Hexcore API:"
curl -s http://localhost:3010/health | jq

echo ""
echo "✅ Setup xong! Đợi sync 100% rồi sử dụng."
echo "📖 API Docs: http://localhost:3010/api-docs"
echo ""
echo "💡 Theo dõi sync:"
echo "   watch -n 30 'curl -s http://localhost:1337/health | jq \".networkSynchronization * 100\"'"
```

### Sau khi sync xong (100%)

```bash
# Verify tất cả hoạt động
curl -s http://localhost:3010/health && echo " ✅ Hexcore OK"
curl -s http://localhost:3010/hydra-main/ogmios > /dev/null && echo " ✅ Ogmios OK"
curl -s http://localhost:1337/health | jq '.networkSynchronization' | grep -q "1" && echo " ✅ Cardano Node synced 100%"

# Mở Swagger docs
echo "🎉 Sẵn sàng! Mở http://localhost:3010/api-docs để bắt đầu"
```

---

## 🎯 Chạy Hydra Node - Flow hoàn chỉnh

> **Yêu cầu:** Cardano Node đã sync 100% (`networkSynchronization: 1`)

### Bước 1: Tạo Admin User (chỉ lần đầu)

```bash
# Tạo admin user trong database
docker exec -it hexcore-mysql mysql -u hexcore -phexcore123 hexcore -e "
  INSERT INTO user (username, password, role) 
  VALUES ('admin', '123456', 'admin') 
  ON DUPLICATE KEY UPDATE password='123456';
"
```

### Bước 2: Đăng nhập lấy Token

```bash
# Login để lấy JWT token
curl -X POST http://localhost:3010/hydra-main/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "123456"}'

# Kết quả: {"data":{"accessToken":"eyJhbGci..."},"statusCode":201,...}

# Lưu token vào biến (copy accessToken từ kết quả trên)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Bước 3: Tạo Cardano Account

```bash
# Tạo account với mnemonic (24 words)
curl -X POST http://localhost:3010/hydra-main/create-account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "mnemonic": "your 24 word mnemonic phrase here..."
  }'

# Kết quả: {"data":{"baseAddress":"addr_test1...","id":1,...},...}

# Kiểm tra danh sách accounts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3010/hydra-main/list-account
```

### Bước 4: Tạo Hydra Party

```bash
# Tạo party với 1 node, sử dụng account id=1
curl -X POST http://localhost:3010/hydra-main/create-party \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nodes": 1,
    "cardanoAccountIds": [1]
  }'

# Kết quả: {"data":{"id":1,"nodes":[...],"status":"INACTIVE",...},...}

# Kiểm tra danh sách parties
curl http://localhost:3010/hydra-main/list-party
```

### Bước 5: Kích hoạt Party (Chạy Hydra Node)

```bash
# Activate party để khởi động Hydra Node
curl -X POST http://localhost:3010/hydra-main/active-party \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id": 1}'

# Kết quả: {"data":{"id":1,"status":"ACTIVE",...},"statusCode":201,...}
```

### Bước 6: Verify Hydra Node đang chạy

```bash
# Kiểm tra container
docker ps | grep hydra-node

# Kết quả mong đợi:
# hexcore-hydra-node-2   ghcr.io/cardano-scaling/hydra-node:0.21.0   Up   0.0.0.0:10005->10005/tcp

# Kiểm tra logs
docker logs hexcore-hydra-node-2 --tail=20

# Kiểm tra Hydra Node API
curl -s http://localhost:10005/protocol-parameters | head -c 200

# Kiểm tra Party status
curl http://localhost:3010/hydra-main/list-party | jq '.data[0].status'
# Kết quả: "ACTIVE"
```

### 🎉 Hoàn tất! Hydra Node Endpoints

| Endpoint | URL | Mô tả |
|----------|-----|-------|
| **Hydra API (HTTP)** | http://localhost:10005 | REST API |
| **Hydra API (WebSocket)** | ws://localhost:10005 | Real-time events |
| **Hydra P2P** | localhost:11005 | Peer-to-peer |

---

## 📋 Script tự động - Copy & Paste

### Script 1: Setup Admin + Login (chạy 1 lần)

```bash
#!/bin/bash
# === SETUP ADMIN ===

# 1. Tạo admin user
docker exec -it hexcore-mysql mysql -u hexcore -phexcore123 hexcore -e "
  INSERT INTO user (username, password, role) 
  VALUES ('admin', '123456', 'admin') 
  ON DUPLICATE KEY UPDATE password='123456';
"

# 2. Login lấy token
RESPONSE=$(curl -s -X POST http://localhost:3010/hydra-main/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "123456"}')

TOKEN=$(echo $RESPONSE | jq -r '.data.accessToken')
echo "TOKEN=$TOKEN"
echo ""
echo "✅ Copy dòng trên để sử dụng trong các bước tiếp theo"
```

### Script 2: Tạo Account + Party + Activate

```bash
#!/bin/bash
# === TẠO VÀ CHẠY HYDRA NODE ===

# Thay YOUR_TOKEN bằng token từ Script 1
TOKEN="YOUR_TOKEN_HERE"

# Thay YOUR_MNEMONIC bằng 24 từ mnemonic của bạn
MNEMONIC="word1 word2 word3 ... word24"

echo "=== 1. Tạo Cardano Account ==="
curl -X POST http://localhost:3010/hydra-main/create-account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"mnemonic\": \"$MNEMONIC\"}"
echo ""

sleep 2

echo "=== 2. Tạo Hydra Party ==="
curl -X POST http://localhost:3010/hydra-main/create-party \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nodes": 1, "cardanoAccountIds": [1]}'
echo ""

sleep 2

echo "=== 3. Activate Party ==="
curl -X POST http://localhost:3010/hydra-main/active-party \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id": 1}'
echo ""

sleep 5

echo "=== 4. Verify ==="
docker ps | grep hydra-node
echo ""
curl http://localhost:3010/hydra-main/list-party | jq '.data[0].status'
echo ""
echo "🎉 Hydra Node đang chạy tại http://localhost:10005"
```

### Script 3: Deactivate Party (Dừng Hydra Node)

```bash
#!/bin/bash
TOKEN="YOUR_TOKEN_HERE"

curl -X POST http://localhost:3010/hydra-main/deactive-party \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id": 1}'

echo ""
echo "✅ Party đã được deactivate, Hydra Node đã dừng"
```

---

## 🔧 Troubleshooting Hydra Node

### Lỗi "Invalid option --hydra-scripts-tx-id"

**Nguyên nhân:** Hydra Node CLI không chấp nhận multiple `--hydra-scripts-tx-id` flags.

**Cách fix:** Sử dụng comma-separated format trong một argument:
```yaml
# docker-compose.local.yml
NEST_HYDRA_NODE_SCRIPT_TX_ID: "txId1,txId2,txId3"
```

### Lỗi "MissingScript"

**Nguyên nhân:** TxId của Hydra scripts không đúng hoặc chưa publish.

**Cách fix:** Publish scripts mới:
```bash
docker run --rm \
  -v hydra-hexcore_cardano_ipc:/ipc \
  -v "$(pwd)/hydra-data/preprod/party-1:/keys" \
  ghcr.io/cardano-scaling/hydra-node:0.21.0 \
  publish-scripts \
  --testnet-magic 1 \
  --node-socket /ipc/node.socket \
  --cardano-signing-key /keys/hexcore-hydra-node-2.cardano.sk

# Output: txId1,txId2,txId3
# Cập nhật vào NEST_HYDRA_NODE_SCRIPT_TX_ID
```

### Lỗi "network hydra-network not found"

**Cách fix:**
```bash
docker network create hydra-network
```

### Kiểm tra Hydra Node logs

```bash
# Xem logs realtime
docker logs -f hexcore-hydra-node-2

# Xem 50 dòng cuối
docker logs hexcore-hydra-node-2 --tail=50
```

---

## 📚 Tham khảo thêm

- [Hydra Documentation](https://hydra.family/head-protocol/)
- [Hydra SDK](https://github.com/Vtechcom/hydra-sdk)
- [Swagger API Docs](http://localhost:3010/api-docs)