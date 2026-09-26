# ?? Apex POS System — High-Speed Retail Point of Sale & Inventory Engine

> Real-time point of sale terminal featuring barcode scanner emulation, hold/recall orders, Stripe payments, thermal receipt generator, and WebSocket stock sync.

---

## ? Overview
**Apex POS** is a responsive, modern retail point of sale solution built for retail shops, supermarkets, and cafes. It provides instant product lookups, shift summary auditing, offline-ready cart handling, and live inventory decrementing.

---

## ??? Architecture Topology

- **Cashier Terminal**: Next.js 15, React 19, Tailwind CSS, Sound FX Engine (Port 3000)
- **Backend API & WebSockets**: Node.js, Express, WebSocket Server, JWT Authentication (Port 3001)
- **Databases**: PostgreSQL (Relational inventory & sales) & Redis (Active cart caching & lock queues)
- **Payment Processing**: Stripe Payment Intent API

---

## ?? Key Modules
1. **Speed Register**: Rapid item lookup, hotkey quantity multipliers, discount modifiers, and sound feedback.
2. **Order Park & Resume**: Hold ongoing transactions to serve urgent customers without cart loss.
3. **Shift Closeout & Cash Drawer Reconciliation**: End-of-day register audit, cash variance tracking, and sales logs.
4. **Receipt Generation**: Printable and downloadable PDF/text receipts.

---

## ??? Quick Start

### 1. Backend API
`ash
cd backend
npm install
npm run dev
`

### 2. Cashier Frontend
`ash
cd frontend
npm install
npm run dev
`

---

## ?? License
Private & Proprietary — Ros Rendo
