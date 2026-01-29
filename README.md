# Nagoya 2026 Trip Planner

**Nagoya 2026 Trip Planner** 是一個專為 2026 名古屋之旅打造的現代化、離線優先 (Local-First) 的行程管理工具。結合了進階的 PWA 技術與美觀的雜誌風格介面。

## 📚 專案文檔 (Documentation)

詳細的專案說明文件請參閱 `docs/` 目錄：

*   **📖 [功能說明與操作指南 (User Guide)](docs/USER_GUIDE.md)**
    *   了解如何使用儀表板、時間軸規劃、智慧匯入以及離線模式。
*   **🛠️ [技術架構與資安檢視 (Technical Architecture)](docs/TECHNICAL_ARCHITECTURE.md)**
    *   詳細闡述 React 19 + RxDB + Supabase 的技術堆疊、系統架構圖以及資安評估報告。

## 🚀 快速開始 (Quick Start)

### 環境需求
*   Node.js (v18+)
*   npm or yarn

### 安裝與執行
```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器
npm run dev

# 3. 建置生產版本
npm run build
```

## ✨ 核心特色 (Key Features)

*   **離線優先 (Offline-First)**: 基於 RxDB，無網路也能完整操作，連線後自動同步。
*   **雜誌風格介面 (Magazine Aesthetic)**: 採用 Editorial Color Palette (Teal/Terracotta) 與精緻的排版。
*   **智慧自動化**: 整合 OpenStreetMap 自動定位與 Open-Meteo 即時氣象。
*   **安全可靠**: 完整的資料驗證 (Zod) 與 權限控制 (RLS)。

---
*Version: v1.1.0*
