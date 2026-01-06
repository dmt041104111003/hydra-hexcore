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

