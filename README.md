# CompactLab IDE

> A browser-based IDE for writing, simulating, and deploying smart contracts on the [Midnight](https://midnight.network) blockchain using the **Compact** language.

---

## What is this?

[Midnight](https://midnight.network) is a privacy-focused blockchain built on Cardano. Smart contracts on Midnight are written in **Compact** — a domain-specific language designed for zero-knowledge proof generation.

**CompactLab** is the development environment for Compact. Think of it as an in-browser IDE — like Remix for Ethereum, but purpose-built for Midnight. You write Compact code, inspect circuits, simulate execution, and deploy contracts, all without leaving your browser.

---

## Features

- **Monaco Editor** — full-featured code editor with Compact syntax highlighting, keyword/type completion, and bracket matching
- **Compact Language Support** — custom tokenizer and theme covering keywords (`circuit`, `contract`, `ledger`, `pragma`), types (`Uint`, `Boolean`, `Bytes`), operators, strings, and comments
- **Resizable Panel Layout** — sidebar for project navigation, central editor, bottom output panel, and right-side circuit inspector — all resizable
- **Circuit Inspector** — visualize the zero-knowledge circuits extracted from your contract, including public/private inputs and witness parameters
- **Simulate & Deploy** — run mock simulations and trigger deployment flows directly from the IDE toolbar
- **Project Management** — create, switch between, and persist multiple Compact projects in the browser
- **Deep Dark Theme** — purpose-designed dark UI with `#F06358` coral brand accent, high-contrast syntax colors, and zero visual noise

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| State | Zustand with persist middleware |
| Panels | react-resizable-panels v4 |
| Animations | Framer Motion |
| Database | Prisma (schema ready, SQLite by default) |
| Validation | Zod |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/Eightblockchain/compactlab-ide.git
cd compactlab-ide
npm install
npm run dev
```

Open [http://localhost:3000/playground](http://localhost:3000/playground) to launch the IDE.

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
compactlab/
├── app/
│   ├── playground/        # Main IDE page
│   ├── api/
│   │   ├── compile/       # Compile endpoint
│   │   ├── deploy/        # Deploy endpoint
│   │   └── projects/      # Project CRUD
│   ├── globals.css        # Design tokens + global styles
│   └── layout.tsx
├── components/
│   ├── editor/
│   │   ├── CompactEditor.tsx      # Monaco editor wrapper
│   │   └── compact-language.ts   # Tokenizer, theme, completions
│   ├── layout/
│   │   ├── Topbar.tsx
│   │   └── Sidebar.tsx
│   └── panels/
│       ├── InspectorPanel.tsx
│       └── BottomPanel.tsx
├── store/
│   └── ide.ts             # Zustand global state
├── lib/
│   ├── compact.ts         # Compact language utilities
│   ├── constants.ts
│   └── utils.ts
└── prisma/
    └── schema.prisma
```

---

## Roadmap

- [ ] Real Compact compiler integration via WASM
- [ ] Live ZK proof simulation output
- [ ] Midnight testnet deployment
- [ ] Project export / import
- [ ] Collaborative editing
- [ ] Dark/light theme toggle

---

## About Midnight & Compact

Midnight is a data-protection blockchain that lets developers build applications where sensitive data is shielded using zero-knowledge proofs. Compact is its native smart contract language — it compiles down to ZK circuits that Midnight executes privately on-chain.

Learn more: [midnight.network](https://midnight.network)

---

## License

MIT
