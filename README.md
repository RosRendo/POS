# Apex POS — High-Speed Retail Point of Sale & Inventory Engine

<div align="center">

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Relational_DB-4169E1?logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-Cache_%26_Locks-DC382D?logo=redis)
![Stripe](https://img.shields.io/badge/Stripe-Payment_Intent-635BFF?logo=stripe)
![pnpm](https://img.shields.io/badge/Maintained_with-pnpm-F69220?logo=pnpm)

**A high-performance retail point-of-sale terminal with barcode scanning, hold/recall orders, cash drawer reconciliation, Stripe payments, thermal receipts, and real-time WebSocket inventory synchronization.**

[Live Architecture](#-system-architecture) • [Database ERD](#-database-entity-relationship-diagram) • [Transaction Sequence](#-transaction--checkout-sequence) • [Quick Start](#-quick-start)

</div>

---

## ⚡ Overview

**Apex POS** is engineered for modern retail, supermarkets, and hospitality environments requiring millisecond-level responsiveness. It delivers an offline-tolerant cashier interface paired with an event-driven Express backend, ensuring instant product lookup, real-time stock sync across multiple terminals via WebSockets, and strict cashier shift audits.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["🖥️ Frontend Cashier Terminal (Port 3000)"]
        UI["Next.js 16 + React 19 Client"]
        CartStore["TanStack Query & IDB Cart Engine"]
        Scanner["Hardware Barcode Listener (HID Keyboard / Camera)"]
        Audio["Sound FX Engine (Scan / Error / Beep)"]
        StripeElem["Stripe Elements / Card Terminal"]
        
        Scanner --> UI
        UI --> CartStore
        CartStore --> Audio
        CartStore --> StripeElem
    end

    subgraph GatewayLayer["⚡ API & Real-Time Sync (Port 3001)"]
        Express["Express.js HTTP API Gateway"]
        AuthMid["JWT Auth & Role Guard (Cashier / Admin)"]
        RateLimiter["Rate Limiting & Helmet Security"]
        WSServer["WebSocket Server (ws)"]
        
        UI <-->|"REST APIs (JSON)"| Express
        UI <-->|"Live Stock & Sale Broadcasts"| WSServer
    end

    subgraph ServiceLayer["⚙️ Core Business Logic"]
        SaleService["Sale & Checkout Controller"]
        InventoryService["Inventory Decrement & Audit Engine"]
        ShiftService["Shift Reconciliation & Cash Drawer Manager"]
        PaymentService["Stripe Payment Intent Service"]
        ReceiptEngine["Thermal Receipt Formatter & PDF Exporter"]
        
        Express --> AuthMid --> RateLimiter
        RateLimiter --> SaleService
        RateLimiter --> ShiftService
        RateLimiter --> InventoryService
        SaleService --> PaymentService
        SaleService --> InventoryService
        SaleService --> ReceiptEngine
        InventoryService --> WSServer
    end

    subgraph DataLayer["💾 Persistence & Caching"]
        Postgres[(PostgreSQL Relational DB)]
        RedisCache[(Redis Cache & Terminal Locks)]
        
        SaleService --> Postgres
        ShiftService --> Postgres
        InventoryService --> Postgres
        Express <--> RedisCache
    end
```

---

## 📊 Database Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ sales : "processes"
    users ||--o{ shifts : "operates"
    users ||--o{ inventory_logs : "records"
    categories ||--o{ products : "contains"
    products ||--o{ sale_items : "included_in"
    products ||--o{ inventory_logs : "tracks"
    sales ||--|{ sale_items : "has"
    sales ||--o{ payments : "settled_via"

    users {
        int id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar role "cashier | admin"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    categories {
        int id PK
        varchar name
        text description
        boolean is_active
        timestamp created_at
    }

    products {
        int id PK
        varchar sku UK
        varchar name
        text description
        int category_id FK
        decimal price
        decimal cost
        int stock_quantity
        int low_stock_threshold
        varchar barcode
        text image_url
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    sales {
        int id PK
        varchar sale_number UK
        int user_id FK
        varchar customer_name
        varchar customer_email
        varchar customer_phone
        decimal subtotal
        decimal tax_amount
        decimal discount_amount
        decimal total_amount
        varchar payment_method "cash | card | qr"
        varchar payment_status "pending | completed | refunded"
        text notes
        timestamp created_at
    }

    sale_items {
        int id PK
        int sale_id FK
        int product_id FK
        varchar product_name
        varchar product_sku
        int quantity
        decimal unit_price
        decimal discount_amount
        decimal total_price
        timestamp created_at
    }

    payments {
        int id PK
        int sale_id FK
        varchar payment_method
        decimal amount
        varchar currency
        varchar stripe_payment_id
        varchar stripe_payment_intent_id
        varchar payment_status
        jsonb metadata
        timestamp created_at
    }

    inventory_logs {
        int id PK
        int product_id FK
        int user_id FK
        varchar type "sale | restock | adjustment | return"
        int quantity_change
        int previous_quantity
        int new_quantity
        int reference_id
        text notes
        timestamp created_at
    }

    shifts {
        int id PK
        int user_id FK
        timestamp started_at
        timestamp ended_at
        decimal opening_cash
        decimal closing_cash
        decimal expected_cash
        decimal cash_difference
        decimal total_sales
        int transaction_count
        text notes
        timestamp created_at
    }

    tax_rates {
        int id PK
        varchar name
        decimal rate
        boolean is_active
        timestamp created_at
    }
```

---

## 🔄 Transaction & Checkout Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Cashier
    participant Terminal as Next.js POS UI
    participant API as Express Gateway
    participant DB as PostgreSQL
    participant Stripe as Stripe Gateway
    participant WS as WebSocket Hub
    actor OtherCashiers as Terminals 2 & 3

    Cashier->>Terminal: Scan Product Barcode / SKU
    Terminal->>Terminal: Update Cart, Calculate Taxes & Discounts
    Terminal->>Terminal: Play Audio Feedback (Beep)
    Cashier->>Terminal: Select Payment (Cash / Stripe Card / QR)
    
    alt Card Payment via Stripe
        Terminal->>API: POST /api/payments/create-intent
        API->>Stripe: Create PaymentIntent
        Stripe-->>Terminal: Client Secret
        Terminal->>Stripe: Confirm Card Charge
        Stripe-->>Terminal: Payment Succeeded
    else Cash Payment
        Cashier->>Terminal: Enter Tendered Cash ($)
        Terminal->>Terminal: Compute Change Due
    end

    Terminal->>API: POST /api/sales (Cart Items, Totals, Tender)
    API->>DB: BEGIN Transaction
    API->>DB: Insert sales and sale_items
    API->>DB: Decrement products.stock_quantity
    API->>DB: Insert inventory_logs
    API->>DB: COMMIT Transaction
    
    API->>WS: Broadcast stock_updated Event
    WS-->>OtherCashiers: Live Update Stock in Terminals 2 & 3
    
    API-->>Terminal: Sale Confirmed (Receipt Payload)
    Terminal->>Cashier: Open Cash Drawer & Print Thermal Receipt
```

---

## 📦 Key Capabilities

- **High-Velocity Scanning**: Sub-50ms barcode debounce with audio feedback and automatic keyboard-wedge listener.
- **Order Hold & Recall**: Park interrupted orders when customers need more items and recall them instantly without cart data loss.
- **Real-Time Multi-Register Sync**: WebSocket broadcast pushes inventory changes immediately across all active terminals to avoid stock-outs.
- **End-of-Day Shift Closeout**: Register opening float, cash drop tracking, expected vs. counted variance, and cashier audit logs.
- **Multi-Rail Payments**: Supports Cash with automatic change calculation, Stripe Payment Intents, and digital QR codes.
- **Offline Reliability**: IndexedDB cart persistence preserves in-progress transactions even during intermittent network dropouts.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.x
- PostgreSQL instance running locally or via Docker
- Redis instance
- `pnpm` (`npm install -g pnpm`)

### 1. Backend Setup
```bash
cd backend
pnpm install

# Configure Environment
cp .env.example .env
# Set DATABASE_URL, REDIS_URL, STRIPE_SECRET_KEY, and JWT_SECRET

# Run DB Migrations & Seeds
pnpm run migrate
pnpm run seed

# Start API Server (Port 3001)
pnpm run dev
```

### 2. Frontend Cashier Setup
```bash
cd ../frontend
pnpm install

# Start Next.js App (Port 3000)
pnpm run dev
```

Visit `http://localhost:3000` to launch the POS terminal.

---

## 🛡️ Security & Auditing

- **Role-Based Access Control**: Strict segregation between `cashier` (sales only) and `admin` (pricing, shifts, inventory adjustments).
- **Immutable Inventory Trail**: Every stock change creates a signed `inventory_logs` record tied to the responsible user and transaction ID.
- **Rate-Limiting & Helmet**: Hardened HTTP headers and API brute-force protection.

---

## 📄 License
Proprietary & Confidential — Engineered by **[Ros Rendo](https://github.com/RosRendo)**