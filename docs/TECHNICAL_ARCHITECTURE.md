# 技術架構與資安檢視報告 (Technical Architecture & Security Report)

本文件詳細闡述 **Nagoya 2026 Trip Planner** 的技術堆疊、系統架構設計以及資安評估報告。本專案採用現代化的 **Local-First** 架構，確保在旅遊途中無網路環境下仍能完整運作。

> Current product name: **Aurea**. Aurea was formerly Journey Ledger, which was refactored from the single-trip Nagoya_ledger app. This document preserves historical architecture context where useful.

---

## 1. 技術堆疊 (Technology Stack)

本專案選用高效能、強型別的現代前端技術棧。

### 核心框架 (Core Framework)
*   **Frontend Library**: **React 19** - 採用最新的 React Hooks 模式進行開發。
*   **Language**: **TypeScript** (~5.9.3) - 全專案採用強型別，確保代碼穩定性與可維護性。
*   **Build Tool**: **Vite 7** - 極速的建置與 HMR (Hot Module Replacement) 開發體驗。

### 狀態與資料庫 (State & Database)
*   **Local Database**: **RxDB** (v16) - 基於瀏覽器的 NoSQL 資料庫 (IndexedDB Wrapper)。
    *   **特性**: 支援即時 Reactive UI 更新，並具備與後端自動同步 (Replication) 的能力。
*   **Backend / Auth**: **Supabase** - 提供 PostgreSQL 資料庫託管與 Authentication 服務。
*   **State Management**: RxDB 本身即作為 Global State 使用 (Reactive Data)，部分 UI 狀態使用 React `useState` / `Context`.

### 使用者介面 (UI / UX)
*   **UI Component Library**: **shadcn/ui** - 基於 **Radix UI** Primitives 的高可客製化元件庫。
*   **Styling**: **Tailwind CSS** (v3.4) - Utility-first CSS 框架，搭配 `tailwindcss-animate` 實現流暢動畫。
*   **Icons**: **Lucide React** - 輕量、風格統一的 SVG icon 庫。
*   **Drag & Drop**: **@dnd-kit** - 用於 Timeline 視圖的精密拖拉操作。

### 工具與驗證 (Utilities & Validation)
*   **Date Handling**: **date-fns** - 輕量級的時間日期處理庫。
*   **Schema Validation**: **Zod** - 用於資料驗證與 TypeScript 型別推斷。
*   **Form Handling**: **react-hook-form** - 高效能的表單處理。
*   **Sanitization**: **DOMPurify** - 防止 XSS 攻擊，淨化使用者輸入的 HTML 內容。
*   **PWA Support**: **vite-plugin-pwa** - 支援漸進式網頁應用安裝 (Installable App) 與離線 Service Worker 緩存。

---

## 2. 系統架構 (System Architecture)

本系統採用 **Local-First Architecture** (優先本地架構)。

### 架構圖 (Architecture Diagram)

```mermaid
graph TD
    User[使用者 User] -->|操作| PWA[PWA Web App (React)]
    PWA -->|讀寫| RxDB[RxDB (Local IndexedDB)]
    RxDB -->|Replication 同步| Supabase[Supabase (Cloud PostgreSQL)]
    
    subgraph "Offline Mode 離線模式"
    RxDB
    end
    
    subgraph "Online Mode 連線模式"
    Supabase
    end
```

### 資料流設計 (Data Flow)
1.  **Reads (讀取)**: UI 直接從本地 **RxDB** 讀取資料。這保證了在網路不穩或離線時，App 仍能瞬間載入並顯示內容 (Zero Latency)。
2.  **Writes (寫入)**: 使用者操作直接寫入本地 **RxDB**。
3.  **Sync (同步)**: 當網路可用時，RxDB 的 Replication Plugin 會在背景自動將本地變更推送 (Push) 至 **Supabase**，並拉取 (Pull) 遠端的最新變更。

---

## 3. 資安評估 (Security Assessment)

本專案在設計之初即導入多層次的安全防護措施。

### 3.1 身份驗證 (Authentication)
*   **機制**: 採用 **Supabase Auth** (基於 JWT - JSON Web Token)。
*   **安全性**: 使用者登入後取得 Access Token，所有與後端資料庫的同步請求皆需驗證此 Token。
*   **Session 管理**: Token 儲存於瀏覽器安全存儲區，並由 Supabase Client SDK 自動管理 Refresh Token 輪替。

### 3.2 資料存取控制 (Data Access Control)
*   **RLS (Row Level Security)**: Supabase PostgreSQL 啟用 RLS 策略。
    *   **規則**: 每個行程 (Trip) 或事件 (Event) 資料表皆設有 Policy，確保使用者「只能讀取/寫入屬於自己」或「被授權共享」的資料。
    *   即使 Client 端代碼被篡改，後端資料庫層級仍會拒絕非法存取。

### 3.3 輸入驗證與防護 (Input Validation & Protection)
*   **XSS 防護 (Cross-Site Scripting)**:
    *   所有使用者可輸入的富文本 (如備註、筆記) 在渲染前皆經過 **DOMPurify** 嚴格淨化，移除任何潛在的惡意 Script 標籤。
*   **Schema Validation**:
    *   使用 **Zod** schema 在前端進行嚴格的資料型別檢查，確保寫入資料庫的 JSON 結構符合預期，防止資料汙染 (Data Corruption)。

### 3.4 傳輸安全 (Transport Security)
*   **HTTPS**: 全站強制使用 HTTPS 加密連線 (由 Vercel 部署環境提供)，防止中間人攻擊 (MITM)。
*   **WebSocket / API**: RxDB 與 Supabase 之間的同步傳輸全程加密。

### 3.5 離線資料安全 (Offline Data Security)
*   本地資料存儲於瀏覽器 **IndexedDB**。雖然這是瀏覽器標準存儲，但受限於 **Same-Origin Policy (同源政策)**，其他惡意網站無法讀取本 App 的本地資料。

---

## 4. 第三方服務與依賴 (Third-Party Services)
*   **Vercel**: 前端部署與 Hosting 服務 (Global CDN)。
*   **Supabase**: Backend-as-a-Service (BaaS) 提供商。
*   **OpenStreetMap (Nominatim)**: 用於地址經緯度解析 (Geocoding)。
*   **Open-Meteo**: 提供精準的氣象資料 API。

---

**報告結語**:
Nagoya 2026 Tool 在架構設計上優先考量了「可用性 (Availability)」與「資料一致性 (Consistency)」，並透過 Supabase 完善的 RLS 機制與前端的嚴格驗證，構建了一個安全、可靠且體驗流暢的旅遊規劃系統。
