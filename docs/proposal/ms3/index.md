# Milestone 3: Gateway Layer Integration & CLI Tool Development

## 📋 Overview

Complete implementation of Gateway Layer Integration and CLI Tool Development for Hydra node management. This milestone delivers a production-ready command-line interface and reverse proxy infrastructure for managing Hydra Heads and monitoring system health.

**Status:** ✅ Completed  
**Submitted:** October 21, 2025  
**Version:** 0.0.1-alpha.3

---

## 🎯 Milestone Outputs

### 1. NGINX Reverse Proxy Configuration

Set up NGINX to route traffic to each Hydra node based on hostname or path, with:
- ✅ Load balancing across multiple Hydra nodes
- ✅ SSL/TLS support for secure communication
- ✅ Dynamic configuration when node count changes
- ✅ IP whitelisting for access control
- ✅ API key/JWT authentication (optional)
- ✅ Request logging for analysis and intrusion detection

**Reference:** [hexcore-proxy.nginx.conf](./hexcore-proxy.nginx.conf)

### 2. Basic Security Layer for Hydra Endpoints

- ✅ IP whitelisting - Allow access only from specific IP addresses
- ✅ Optional API key/JWT authentication for enhanced security
- ✅ Comprehensive logging system for all access requests
- ✅ Intrusion detection capabilities

### 3. CLI Tool Development – hexcore-cli

Full-featured command-line interface enabling:
- ✅ Create new Hydra Heads with custom parameters
- ✅ Stop/Start/Restart Heads (Stop Party, Active Party)
- ✅ Clear party persistence data
- ✅ List all Hydra Heads with status indicators
- ✅ View wallet accounts with UTxO data
- ✅ Real-time system health monitoring
- ✅ Interactive dashboard with keyboard navigation
- ✅ Batch capabilities for managing multiple Heads simultaneously

**Reference:** [GitHub - hexcore-cli](https://github.com/Vtechcom/hexcore-cli)  
**Documentation:** [hexcore-cli README](https://github.com/Vtechcom/hexcore-cli/blob/main/README.md)

### 4. Advanced Logging System

- ✅ Real-time log streaming integrated in CLI
- ✅ Filter logs by node or Head
- ✅ Export logs to JSON/text files for offline analysis
- ✅ Request tracking and analysis

---

## ✅ Acceptance Criteria

### Full CLI Functionality
- ✅ hexcore-cli performs all actions: create Head, stop Head, view status, retrieve logs
- ✅ Commands return immediate feedback with clear error messages
- ✅ Support for custom parameters during Head initialization
- ✅ Batch operations for managing multiple Heads

### Gateway Security for Hydra Endpoints
- ✅ NGINX reverse proxy operates reliably
- ✅ Blocks all unauthorized requests
- ✅ IP whitelist validation working correctly
- ✅ API key/JWT validation (if enabled) functions properly

### Load Handling and Scalability
- ✅ Stress tested with 10-20 concurrent Heads
- ✅ No significant performance degradation under load
- ✅ Complete logs maintained without data loss

### Documentation and Usage Guide
- ✅ Comprehensive README with setup and configuration instructions
- ✅ Sample nginx.conf configuration for production deployment
- ✅ CLI usage examples and best practices

---

## 📦 Deliverables

### Public CLI Source Code
- **Repository:** https://github.com/Vtechcom/hexcore-cli
- **Language:** Node.js + TypeScript
- **Architecture:** Modular, extendable structure
- **Build Targets:** macOS (ARM64/x64), Linux x64, Windows x64

### Documentation
- [hexcore-cli README](https://github.com/Vtechcom/hexcore-cli/blob/main/README.md) - Setup, configuration, and CLI usage
- [Gateway Integration Instructions](https://github.com/Vtechcom/hexcore-cli) - Hydra node integration guide

### Configuration Files
- [hexcore-proxy.nginx.conf](./hexcore-proxy.nginx.conf) - Production NGINX configuration
  - Reverse proxy setup
  - IP whitelist rules
  - API key/JWT protection
  - SSL/TLS configuration examples

### Features Implemented

#### Dashboard & Navigation
- Interactive dashboard with 5-item menu system
- Real-time system overview (updated every 5 seconds)
- Keyboard navigation: Arrow keys, vi-style (j/k), number keys (1-5)

#### Heads Management
- Create new heads with multi-account selection
- List heads in tree-style view with scrolling
- Color-coded status indicators (🟢 ACTIVE / 🔴 INACTIVE)
- Head detail view with S/C/R actions:
  - **[S]** Stop cluster (`deactive-cluster`)
  - **[C]** Clear persistence data
  - **[R]** Start/Restart cluster

#### Account Management
- View all wallet accounts with addresses
- Fetch UTxO data with progress tracking
- Real-time account updates

#### System Monitoring
- Nodes list with port and account information
- Health status dashboard with system metrics

---

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/Vtechcom/hexcore-cli.git
cd hexcore-cli
npm install
npm run build
```

### Running CLI
```bash
npm run dev -- start --url https://api.hexcore.io.vn -u admin -p password
```

### Binary Distribution
```bash
npm run pkg:mac    # macOS (ARM64 + x64)
npm run pkg:linux  # Linux x64
npm run pkg:win    # Windows x64
```

---

## 📊 Technical Stack

- **UI Framework:** Blessed.js (Terminal UI)
- **Language:** TypeScript 5.3.3
- **HTTP Client:** Axios
- **Testing:** Vitest (28/28 tests passing)
- **Build:** pkg v5.8.1 for binary packaging
- **Node Requirement:** >=18.0.0

---

## 🔗 Related Files

- [hexcore-proxy.nginx.conf](./hexcore-proxy.nginx.conf) - Nginx configuration
- [Acceptance Criteria](./acceptance.md) - Full acceptance details
- [GitHub Repository](https://github.com/Vtechcom/hexcore-cli) - Source code
