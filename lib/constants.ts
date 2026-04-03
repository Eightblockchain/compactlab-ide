// ─── Template types ────────────────────────────────────────────────────────────

export type TemplateKey =
  | "hello-world"
  | "counter"
  | "voting"
  | "bulletin-board"
  | "owned"
  | "token"
  | "registry"
  | "profile"
  | "escrow"
  | "commitment"
  | "blank";

export interface TemplateFile {
  name: string;
  language: "compact" | "markdown" | "json";
  content: string;
}

export interface CompactTemplate {
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  files: TemplateFile[];
}

export const COMPACT_TEMPLATES: Record<TemplateKey, CompactTemplate> = {
  // 01 ─── Hello World ────────────────────────────────────────────────────────
  "hello-world": {
    name: "Hello World",
    description: "Store a public message on-chain — the simplest Compact contract",
    difficulty: "beginner",
    tags: ["Opaque<string>", "disclose", "ledger"],
    files: [
      {
        name: "hello-world.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// The simplest Compact contract: store a public message on-chain.
//
// Concepts covered:
//  - Opaque<"string">: how Compact handles string values
//  - export ledger: public on-chain state readable by anyone
//  - constructor(): runs at deploy time, NOT a ZK circuit
//  - export circuit: a callable ZK-proven state transition
//  - disclose(): required when writing circuit parameters to the ledger

export ledger message: Opaque<"string">;

constructor() {
  // Initial message set at deploy time.
  // In a constructor, string literals can be written to the ledger directly.
  message = "Hello, Midnight!";
}

// Update the message. Anyone can call this.
// newMessage is a circuit parameter — disclose() is required to write it
// to a public ledger. Without disclose(), the compiler rejects the write.
export circuit storeMessage(newMessage: Opaque<"string">): [] {
  message = disclose(newMessage);
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Hello World

The simplest possible Compact contract: store a public message on-chain.

## Concepts

| Concept | Code |
|---|---|
| String type | \`Opaque<"string">\` |
| Public state | \`export ledger message: Opaque<"string">;\` |
| Deploy-time init | \`constructor() { message = "Hello, Midnight!"; }\` |
| ZK circuit | \`export circuit storeMessage(...): [] { ... }\` |
| Explicit disclosure | \`message = disclose(newMessage);\` |

## Why \`disclose()\`?

Compact's compiler tracks data provenance. Any value that enters a circuit
from the outside (a parameter or a witness) is treated as potentially
private until you explicitly call \`disclose()\` on it. This prevents
accidental data leaks — if you forget, the compiler refuses to compile.
`,
      },
    ],
  },

  // 02 ─── Counter ────────────────────────────────────────────────────────────
  counter: {
    name: "Counter",
    description: "On-chain counter using the built-in Counter type",
    difficulty: "beginner",
    tags: ["Counter", "Uint<64>", "increment"],
    files: [
      {
        name: "counter.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// On-chain counter using Midnight's built-in Counter type.
//
// Concepts covered:
//  - Counter: a built-in type that can ONLY go up (append-only)
//  - .increment(n): the single mutation method on Counter
//  - Multiple circuits in one contract
//  - Uint<64>: fixed-width unsigned integer parameter type

export ledger round: Counter;

constructor() {
  // Counter initialises to 0 automatically — no explicit init needed.
}

// Add 1 to the counter.
export circuit increment(): [] {
  round.increment(1);
}

// Add a custom amount. Caller provides the value as a circuit parameter.
export circuit incrementBy(amount: Uint<64>): [] {
  round.increment(amount);
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Counter

An on-chain counter backed by Compact's built-in \`Counter\` ledger type.

## Concepts

| Concept | Code |
|---|---|
| Built-in Counter type | \`export ledger round: Counter;\` |
| Append-only increment | \`round.increment(1);\` |
| Circuit parameter | \`export circuit incrementBy(amount: Uint<64>): []\` |

## Notes

- \`Counter\` can never be decremented or reset — it is strictly monotonic
- Each call to \`increment\` or \`incrementBy\` produces a ZK proof on-chain
- The current value of \`round\` is readable by anyone via the Midnight indexer
`,
      },
    ],
  },

  // 03 ─── Anonymous Voting ───────────────────────────────────────────────────
  voting: {
    name: "Anonymous Voting",
    description: "Private ballot — who voted is public, what they voted is secret",
    difficulty: "beginner",
    tags: ["witness", "Set<T>", "enum", "ownPublicKey"],
    files: [
      {
        name: "voting.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Anonymous on-chain voting.
//
// Privacy model:
//  - WHO voted: public (ZswapCoinPublicKey in a Set prevents double-voting)
//  - WHAT they voted: PRIVATE (witness — never written to the ledger)
//  - The ZK proof shows a valid binary choice was made without revealing it
//
// Concepts covered:
//  - enum: named states, used here as a voting status flag
//  - witness: private input provided off-chain by the caller's TypeScript wallet
//  - Set<T>: built-in collection for membership (no duplicates)
//  - Counter: append-only tally
//  - ownPublicKey(): the ZswapCoinPublicKey of the transaction caller

export enum VotingState { Open, Closed }

export ledger state: VotingState;
export ledger votesFor: Counter;
export ledger votesAgainst: Counter;
export ledger voters: Set<ZswapCoinPublicKey>;

// The caller supplies their vote choice entirely off-chain.
// The ZK proof shows a valid Boolean was provided — without revealing it.
witness voteChoice(): Boolean;

constructor() {
  state = VotingState.Open;
}

// Cast a private ballot.
export circuit castVote(): [] {
  assert(state == VotingState.Open, "Voting is closed");

  const voter = ownPublicKey();
  assert(!voters.member(voter), "Already voted");

  // Participation goes on-chain (prevents double-votes).
  // ownPublicKey() is inherently public — disclose() is still required for Set.insert.
  voters.insert(disclose(voter));

  // The choice is consumed inside the ZK circuit. It never appears on-chain.
  const choice = voteChoice();
  if (choice) {
    votesFor.increment(1);
  } else {
    votesAgainst.increment(1);
  }
}

// End the voting period.
export circuit closeVoting(): [] {
  assert(state == VotingState.Open, "Already closed");
  state = VotingState.Closed;
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Anonymous Voting

A zero-knowledge voting system where ballot choices are provably secret.

## Privacy model

| Data | On-chain? | Why |
|---|---|---|
| Who voted | Yes | Stored in \`voters: Set<ZswapCoinPublicKey>\` to prevent double-voting |
| Vote choice | No | Stays in the witness; only the tally changes |
| Tallies | Yes | \`votesFor\` and \`votesAgainst\` are public Counters |

## Concepts

| Concept | Code |
|---|---|
| Enum state | \`export enum VotingState { Open, Closed }\` |
| Private witness | \`witness voteChoice(): Boolean;\` |
| Set membership | \`voters.member(voter)\` / \`voters.insert(disclose(voter))\` |
| Caller identity | \`ownPublicKey(): ZswapCoinPublicKey\` |

## How the ZK proof works

The caller's wallet generates a proof that:
1. A valid \`Boolean\` was provided as \`voteChoice\`
2. The caller has not voted before (not in \`voters\`)
3. The correct counter was incremented

The choice itself never appears in the proof transcript.
`,
      },
    ],
  },

  // 04 ─── Bulletin Board ─────────────────────────────────────────────────────
  "bulletin-board": {
    name: "Bulletin Board",
    description: "One-slot board: post and remove with ZK ownership proof",
    difficulty: "beginner",
    tags: ["Maybe<T>", "witness", "persistentHash", "auth"],
    files: [
      {
        name: "bulletin-board.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Single-slot bulletin board with secret-key ownership.
// Inspired by the official Midnight bboard example.
//
// Concepts covered:
//  - Maybe<T>: optional values — none<T>() and some<T>(value)
//  - witness: private key used to prove ownership without revealing it
//  - persistentHash<T>(): deterministic hashing to derive a public key from a secret
//  - sequence counter: prevents reuse of the same key after a takedown
//  - ZK ownership proof: prove you know the secret without revealing it

export enum State { VACANT, OCCUPIED }

export ledger state: State;
export ledger message: Maybe<Opaque<"string">>;
export ledger sequence: Counter;
export ledger owner: Bytes<32>;

// The poster's secret key — stays on their device, never transmitted.
witness localSecretKey(): Bytes<32>;

constructor() {
  state = State.VACANT;
  message = none<Opaque<"string">>();
  sequence.increment(1);
}

// Post a message. Derives and stores a public key from the secret + sequence.
export circuit post(newMessage: Opaque<"string">): [] {
  assert(state == State.VACANT, "Board is occupied");
  owner = disclose(boardPublicKey(localSecretKey(), sequence as Field as Bytes<32>));
  message = disclose(some<Opaque<"string">>(newMessage));
  state = State.OCCUPIED;
}

// Remove the message. Proves ownership by reproducing the same public key.
export circuit takeDown(): Opaque<"string"> {
  assert(state == State.OCCUPIED, "Board is empty");
  assert(
    owner == boardPublicKey(localSecretKey(), sequence as Field as Bytes<32>),
    "Not the current owner"
  );
  const formerMessage = message.value;
  state = State.VACANT;
  sequence.increment(1);
  message = none<Opaque<"string">>();
  return formerMessage;
}

// Private helper: derives a unique 32-byte key from [prefix, sequence, secret].
// The sequence prevents replay attacks — old keys are invalid after takeDown.
circuit boardPublicKey(sk: Bytes<32>, seq: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "bboard:pk:"), seq, sk]);
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Bulletin Board

A single-slot bulletin board where only the original poster can remove their message.
Ownership is proven with a ZK proof — the secret key is never revealed.

## Concepts

| Concept | Code |
|---|---|
| Optional value | \`export ledger message: Maybe<Opaque<"string">>;\` |
| Create optional | \`some<Opaque<"string">>(newMessage)\` / \`none<Opaque<"string">>()\` |
| Unwrap optional | \`message.value\` |
| Deterministic hash | \`persistentHash<Vector<3, Bytes<32>>>([...])\` |
| Private witness | \`witness localSecretKey(): Bytes<32>;\` |
| Private helper circuit | \`circuit boardPublicKey(...)\` (no \`export\`) |

## Ownership pattern

1. **Post**: hash(secret + sequence) → stored as \`owner\` (public)
2. **TakeDown**: re-derive hash(secret + sequence) → must equal stored \`owner\`
3. **Sequence**: incremented after each takedown so old keys cannot be reused

The secret never leaves the proof generation step.
`,
      },
    ],
  },

  // 05 ─── Owned Contract ─────────────────────────────────────────────────────
  owned: {
    name: "Owned Contract",
    description: "Admin pattern — access control with a transferable owner role",
    difficulty: "beginner",
    tags: ["ZswapCoinPublicKey", "ownPublicKey", "admin", "assert"],
    files: [
      {
        name: "owned.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Access-controlled contract with a transferable admin role.
//
// Concepts covered:
//  - ZswapCoinPublicKey: the native account identifier on Midnight
//  - ownPublicKey(): get the caller's identity inside a circuit
//  - Admin pattern: deployer becomes the admin in the constructor
//  - assert() as an access guard: rejects unauthorised callers
//  - Transferable ownership: handing off control to another key
//  - Boolean ledger fields: toggling a pause switch

export ledger admin: ZswapCoinPublicKey;
export ledger paused: Boolean;
export ledger storedValue: Uint<64>;

constructor() {
  // The deployer's key becomes the admin.
  // In a constructor, ownPublicKey() can be written directly — no disclose() needed.
  admin = ownPublicKey();
  paused = false;
  storedValue = 0;
}

// Update the stored value. Admin only, and only when not paused.
export circuit setValue(newValue: Uint<64>): [] {
  assert(ownPublicKey() == admin, "Only admin can set value");
  assert(!paused, "Contract is paused");
  storedValue = disclose(newValue);
}

// Pause the contract (admin only).
export circuit pause(): [] {
  assert(ownPublicKey() == admin, "Only admin can pause");
  paused = true;
}

// Resume the contract (admin only).
export circuit unpause(): [] {
  assert(ownPublicKey() == admin, "Only admin can unpause");
  paused = false;
}

// Transfer the admin role to a new public key.
export circuit transferAdmin(newAdmin: ZswapCoinPublicKey): [] {
  assert(ownPublicKey() == admin, "Only admin can transfer");
  admin = disclose(newAdmin);
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Owned Contract

Demonstrates the standard admin ownership pattern in Compact.

## Concepts

| Concept | Code |
|---|---|
| Native account type | \`ZswapCoinPublicKey\` |
| Deployer identity | \`admin = ownPublicKey();\` (in constructor) |
| Role check | \`assert(ownPublicKey() == admin, "Only admin")\` |
| Boolean ledger | \`export ledger paused: Boolean;\` |
| Literal write | \`paused = true;\` (no disclose needed for literals) |
| Param write | \`admin = disclose(newAdmin);\` (disclose needed for params) |

## disclose() rules

| Source | Needs disclose? | Example |
|---|---|---|
| String / bool / enum literal | No | \`paused = true;\` |
| \`ownPublicKey()\` in constructor | No | \`admin = ownPublicKey();\` |
| Circuit parameter | Yes | \`admin = disclose(newAdmin);\` |
| Witness result | Yes | \`x = disclose(myWitness());\` |
`,
      },
    ],
  },

  // 06 ─── Fungible Token ─────────────────────────────────────────────────────
  token: {
    name: "Fungible Token",
    description: "ERC-20 style token with Map<ZswapCoinPublicKey, Uint<128>> balances",
    difficulty: "intermediate",
    tags: ["Map<K,V>", "sealed ledger", "Uint<128>", "arithmetic"],
    files: [
      {
        name: "token.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// ERC-20 style fungible token with public balances.
//
// Concepts covered:
//  - sealed ledger: written once in constructor, permanently immutable
//  - Map<K, V>: .member(k), .lookup(k), .insert(k, v) — the core Compact dictionary
//  - Uint<128> arithmetic: must cast back with "as Uint<128>" after + or -
//  - disclose() on both key and value when inserting into a Map from a circuit

export sealed ledger tokenName: Opaque<"string">;
export sealed ledger tokenSymbol: Opaque<"string">;
export ledger totalSupply: Uint<128>;
export ledger balances: Map<ZswapCoinPublicKey, Uint<128>>;

constructor() {
  tokenName = "MidToken";
  tokenSymbol = "MDT";
  const initialSupply: Uint<128> = 1000000;
  totalSupply = initialSupply;
  // Give all initial tokens to the deployer.
  balances.insert(ownPublicKey(), initialSupply);
}

// Send tokens from the caller to another account.
export circuit transfer(to: ZswapCoinPublicKey, amount: Uint<128>): [] {
  const sender = ownPublicKey();
  assert(balances.member(sender), "Sender has no balance");
  const senderBal = balances.lookup(sender);
  assert(senderBal >= amount, "Insufficient balance");
  // Uint<128> arithmetic: subtract then cast back.
  balances.insert(disclose(sender), disclose(senderBal - amount as Uint<128>));
  if (balances.member(disclose(to))) {
    const toBal = balances.lookup(disclose(to));
    balances.insert(disclose(to), disclose(toBal + amount as Uint<128>));
  } else {
    balances.insert(disclose(to), disclose(amount));
  }
}

// Read any account's balance.
export circuit balanceOf(account: ZswapCoinPublicKey): Uint<128> {
  if (!balances.member(disclose(account))) {
    return 0;
  }
  return balances.lookup(disclose(account));
}

// Mint new tokens (add admin check for production use).
export circuit mint(to: ZswapCoinPublicKey, amount: Uint<128>): [] {
  totalSupply = disclose(totalSupply + amount as Uint<128>);
  if (balances.member(disclose(to))) {
    const bal = balances.lookup(disclose(to));
    balances.insert(disclose(to), disclose(bal + amount as Uint<128>));
  } else {
    balances.insert(disclose(to), disclose(amount));
  }
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Fungible Token

An ERC-20 style token with public balances stored in a \`Map\`.

## State

| Ledger | Type | Notes |
|---|---|---|
| \`tokenName\` | \`sealed Opaque<"string">\` | Set once in constructor |
| \`tokenSymbol\` | \`sealed Opaque<"string">\` | Set once in constructor |
| \`totalSupply\` | \`Uint<128>\` | Updated on mint |
| \`balances\` | \`Map<ZswapCoinPublicKey, Uint<128>>\` | Account → balance |

## Concepts

| Concept | Code |
|---|---|
| Sealed (immutable) ledger | \`export sealed ledger tokenName: Opaque<"string">;\` |
| Map member check | \`balances.member(sender)\` |
| Map read | \`balances.lookup(sender)\` |
| Map write | \`balances.insert(disclose(k), disclose(v))\` |
| Safe arithmetic | \`senderBal - amount as Uint<128>\` |

## Production checklist

- [ ] Add \`assert(ownPublicKey() == admin, "...")\` to \`mint\`
- [ ] Add allowance mapping for delegated transfers
`,
      },
    ],
  },

  // 07 ─── Name Registry ──────────────────────────────────────────────────────
  registry: {
    name: "Name Registry",
    description: "Map Bytes<32> names to owners — register, transfer, release",
    difficulty: "intermediate",
    tags: ["Map<Bytes<32>,…>", "Counter as ID", "CRUD", "ownership"],
    files: [
      {
        name: "registry.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Name registry: map fixed-size byte labels to their owner's public key.
//
// Concepts covered:
//  - Map<Bytes<32>, ZswapCoinPublicKey>: string-like keys with Map
//  - Counter as an ID generator: auto-incrementing, guaranteed unique
//  - CRUD pattern: register, lookup, transfer ownership, release (delete)
//  - Ownership check before mutation: assert caller == stored owner

export ledger entries: Map<Bytes<32>, ZswapCoinPublicKey>;
export ledger nameCount: Counter;

constructor() {
  // Map starts empty; Counter starts at 0.
}

// Register a name. The name must not already be taken.
// Callers pass a Bytes<32> label — use pad(32, "myname") in TypeScript.
export circuit register(name: Bytes<32>): [] {
  assert(!entries.member(disclose(name)), "Name already taken");
  entries.insert(disclose(name), disclose(ownPublicKey()));
  nameCount.increment(1);
}

// Transfer a name to a new owner. Only the current owner can do this.
export circuit transfer(name: Bytes<32>, to: ZswapCoinPublicKey): [] {
  assert(entries.member(disclose(name)), "Name not found");
  assert(entries.lookup(disclose(name)) == ownPublicKey(), "Not the owner");
  entries.insert(disclose(name), disclose(to));
}

// Release (delete) a name. Only the owner can release.
export circuit release(name: Bytes<32>): [] {
  assert(entries.member(disclose(name)), "Name not found");
  assert(entries.lookup(disclose(name)) == ownPublicKey(), "Not the owner");
  entries.remove(disclose(name));
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Name Registry

A CRUD registry mapping \`Bytes<32>\` names to their owners.

## Concepts

| Concept | Code |
|---|---|
| Bytes<32> key in Map | \`Map<Bytes<32>, ZswapCoinPublicKey>\` |
| Member check (param key) | \`entries.member(disclose(name))\` |
| Lookup with comparison | \`entries.lookup(disclose(name)) == ownPublicKey()\` |
| Delete from Map | \`entries.remove(disclose(name))\` |
| Auto-increment counter | \`nameCount.increment(1);\` |

## Using Bytes<32> as names

In the TypeScript SDK, convert a string to \`Bytes<32>\` with:
\`\`\`typescript
import { pad } from "@midnight-ntwrk/compact-runtime";
const nameBytes = pad(32, "myname"); // zero-padded to 32 bytes
\`\`\`

In Compact itself, use: \`pad(32, "literal-string")\`.
`,
      },
    ],
  },

  // 08 ─── Player Profile (struct) ────────────────────────────────────────────
  profile: {
    name: "Player Profile",
    description: "struct types and Map of structs — read, write, and update fields",
    difficulty: "intermediate",
    tags: ["struct", "Map<…,struct>", "field access", "update pattern"],
    files: [
      {
        name: "profile.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Public player profile registry using struct types.
//
// Concepts covered:
//  - struct: composite data types with named, typed fields
//  - Struct literals: PlayerProfile { score: ..., level: ..., active: ... }
//  - Map<ZswapCoinPublicKey, PlayerProfile>: a map whose values are structs
//  - Field access: p.score, p.level, p.active
//  - Update pattern: read existing struct, build a new one with changed fields
//  - Uint<8> arithmetic: (p.level + 1) as Uint<8>

export struct PlayerProfile {
  score: Uint<32>;
  level: Uint<8>;
  active: Boolean;
}

export ledger profiles: Map<ZswapCoinPublicKey, PlayerProfile>;
export ledger playerCount: Counter;

constructor() {
  // Map starts empty; Counter starts at 0.
}

// Join the game with an initial profile.
export circuit register(score: Uint<32>, level: Uint<8>): [] {
  const caller = ownPublicKey();
  assert(!profiles.member(caller), "Already registered");
  profiles.insert(disclose(caller), disclose(PlayerProfile {
    score: score,
    level: level,
    active: true,
  }));
  playerCount.increment(1);
}

// Update your own score.
export circuit updateScore(newScore: Uint<32>): [] {
  const caller = ownPublicKey();
  assert(profiles.member(caller), "Not registered");
  const p = profiles.lookup(caller);
  // Build a new struct with the updated field (structs are immutable).
  profiles.insert(disclose(caller), disclose(PlayerProfile {
    score: newScore,
    level: p.level,
    active: p.active,
  }));
}

// Level up (increment level by 1).
export circuit levelUp(): [] {
  const caller = ownPublicKey();
  assert(profiles.member(caller), "Not registered");
  const p = profiles.lookup(caller);
  profiles.insert(disclose(caller), disclose(PlayerProfile {
    score: p.score,
    level: (p.level + 1) as Uint<8>,
    active: p.active,
  }));
}

// Deactivate your profile.
export circuit deactivate(): [] {
  const caller = ownPublicKey();
  assert(profiles.member(caller), "Not registered");
  const p = profiles.lookup(caller);
  profiles.insert(disclose(caller), disclose(PlayerProfile {
    score: p.score,
    level: p.level,
    active: false,
  }));
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Player Profile

Demonstrates Compact's \`struct\` type via a public player registry.

## Concepts

| Concept | Code |
|---|---|
| Struct definition | \`export struct PlayerProfile { score: Uint<32>; level: Uint<8>; active: Boolean; }\` |
| Struct literal | \`PlayerProfile { score: 100, level: 1, active: true }\` |
| Field access | \`p.score\`, \`p.level\`, \`p.active\` |
| Map of structs | \`Map<ZswapCoinPublicKey, PlayerProfile>\` |
| Struct update | Read → build new literal with changed fields → insert |
| Uint<8> arithmetic | \`(p.level + 1) as Uint<8>\` |

## Struct update pattern

Compact structs are immutable value types. To "update" a field, create a
new struct with the changed field and the old values for everything else:

\`\`\`compact
const p = profiles.lookup(caller);
profiles.insert(disclose(caller), disclose(PlayerProfile {
  score: newScore,   // changed
  level: p.level,   // copied from old
  active: p.active, // copied from old
}));
\`\`\`
`,
      },
    ],
  },

  // 09 ─── Escrow ─────────────────────────────────────────────────────────────
  escrow: {
    name: "Escrow",
    description: "State-machine escrow with arbiter — enum transitions and role guards",
    difficulty: "intermediate",
    tags: ["enum state machine", "multi-party", "ZswapCoinPublicKey", "roles"],
    files: [
      {
        name: "escrow.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Two-party escrow managed by an arbiter.
//
// State machine:
//   Awaiting → Active → Released
//                     ↘ Refunded
//
// Concepts covered:
//  - enum as a state machine: only valid transitions are permitted
//  - Multiple ZswapCoinPublicKey ledger fields (buyer, seller, arbiter)
//  - assert() guards for role-based access control
//  - Sequential state transitions that can only flow forward
//  - Storing Uint<64> amounts with disclose()

export enum EscrowState { Awaiting, Active, Released, Refunded }

export ledger arbiter: ZswapCoinPublicKey;
export ledger buyer: ZswapCoinPublicKey;
export ledger seller: ZswapCoinPublicKey;
export ledger amount: Uint<64>;
export ledger state: EscrowState;

constructor() {
  // Deployer becomes the arbiter.
  // buyer and seller start as the deployer; configure() sets them properly.
  arbiter = ownPublicKey();
  buyer   = ownPublicKey();
  seller  = ownPublicKey();
  amount  = 0;
  state   = EscrowState.Awaiting;
}

// Arbiter sets up the escrow with buyer, seller, and locked amount.
export circuit configure(
  _buyer: ZswapCoinPublicKey,
  _seller: ZswapCoinPublicKey,
  _amount: Uint<64>
): [] {
  assert(ownPublicKey() == arbiter, "Only arbiter");
  assert(state == EscrowState.Awaiting, "Already configured");
  buyer  = disclose(_buyer);
  seller = disclose(_seller);
  amount = disclose(_amount);
  state  = EscrowState.Active;
}

// Arbiter releases funds to the seller (deal completed).
export circuit release(): [] {
  assert(ownPublicKey() == arbiter, "Only arbiter");
  assert(state == EscrowState.Active, "Not active");
  state = EscrowState.Released;
}

// Arbiter refunds to the buyer (deal cancelled).
export circuit refund(): [] {
  assert(ownPublicKey() == arbiter, "Only arbiter");
  assert(state == EscrowState.Active, "Not active");
  state = EscrowState.Refunded;
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Escrow

A two-party escrow managed by an arbiter, demonstrating enum-based state machines.

## State machine

\`\`\`
Awaiting ──configure()──▶ Active ──release()──▶ Released
                                 └──refund()──▶ Refunded
\`\`\`

## Concepts

| Concept | Code |
|---|---|
| Enum state machine | \`export enum EscrowState { Awaiting, Active, Released, Refunded }\` |
| State guard | \`assert(state == EscrowState.Awaiting, "...")\` |
| Role guard | \`assert(ownPublicKey() == arbiter, "...")\` |
| Param → ledger write | \`buyer = disclose(_buyer);\` |
| Literal → ledger write | \`state = EscrowState.Active;\` (no disclose) |

## disclose() vs literal

Enum variants (\`EscrowState.Active\`) and boolean literals (\`true\`) are compile-time
constants and do not need \`disclose()\`. Only values that flow in from circuit
parameters or witnesses need the explicit \`disclose()\` annotation.
`,
      },
    ],
  },

  // 10 ─── ZK Commitment ──────────────────────────────────────────────────────
  commitment: {
    name: "ZK Commitment",
    description: "Commit-reveal: prove knowledge of a secret without revealing it",
    difficulty: "advanced",
    tags: ["persistentHash<T>", "witness", "Bytes<32>", "ZK proof-of-knowledge"],
    files: [
      {
        name: "commitment.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Zero-knowledge commitment scheme.
//
// The classic commit-reveal pattern:
//  Phase 1 — Commit:  store hash(secret) on-chain (public)
//  Phase 2 — Prove:   demonstrate knowledge of the secret
//                     without ever revealing it
//
// Concepts covered:
//  - persistentHash<T>(): deterministic, chain-stable hash of any Compact type
//  - witness: private value that stays on the prover's device
//  - Bytes<32>: fixed-size byte arrays (hash output, secret keys)
//  - ZK proof of knowledge: the circuit proves "I know X such that hash(X) = C"
//    without X appearing in the transaction or on-chain state

export ledger commitments: Map<Bytes<32>, ZswapCoinPublicKey>;
export ledger commitCount: Counter;

// The secret stays entirely off-chain. It is never transmitted or stored.
witness secretKey(): Bytes<32>;

constructor() {
  // commitments map starts empty; counter starts at 0.
}

// Phase 1 — Commit.
// Computes hash(secret) and stores it publicly.
// Anyone can verify the commitment exists; no one can derive the secret from the hash.
export circuit commit(): [] {
  const sk = secretKey();
  const commitment = persistentHash<Bytes<32>>(sk);
  assert(!commitments.member(disclose(commitment)), "Already committed");
  commitments.insert(disclose(commitment), disclose(ownPublicKey()));
  commitCount.increment(1);
}

// Phase 2 — Prove.
// Proves knowledge of the secret behind a previously stored commitment.
// The ZK circuit verifies hash(secret) == expectedCommitment without
// the secret appearing in the proof transcript.
export circuit prove(expectedCommitment: Bytes<32>): [] {
  const sk = secretKey();
  const computed = persistentHash<Bytes<32>>(sk);
  assert(computed == expectedCommitment, "Wrong secret: hash mismatch");
  assert(commitments.member(disclose(expectedCommitment)), "Commitment not found");
  assert(
    commitments.lookup(disclose(expectedCommitment)) == ownPublicKey(),
    "Not the committer"
  );
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# ZK Commitment

The foundational ZK primitive: prove you know a secret without revealing it.

## Protocol

1. **Commit**: \`commit()\` — hash your secret and store the hash on-chain
2. **Later prove**: \`prove(commitment)\` — the ZK proof shows \`hash(secret) == commitment\`
   without the secret ever leaving your device

## Concepts

| Concept | Code |
|---|---|
| Deterministic hash | \`persistentHash<Bytes<32>>(sk)\` |
| Private witness | \`witness secretKey(): Bytes<32>;\` |
| Hash output type | \`Bytes<32>\` |
| Store commitment | \`commitments.insert(disclose(commitment), disclose(ownPublicKey()))\` |
| Verify in ZK | \`assert(computed == expectedCommitment, "...")\` |

## Why \`persistentHash\` vs \`transientHash\`?

| | \`persistentHash\` | \`transientHash\` |
|---|---|---|
| Deterministic across chains? | Yes | No |
| Use for commitments? | Yes | No |
| Use for nonces/IDs? | Either | Yes |

## Real-world uses

- Age verification without revealing your date of birth
- Credential proofs without exposing the credential
- Sealed-bid auctions: commit your bid, reveal after deadline
`,
      },
    ],
  },

  // 11 ─── Blank (scaffold, modal only) ──────────────────────────────────────
  blank: {
    name: "Blank Contract",
    description: "Empty scaffold with correct Compact syntax and inline guide",
    difficulty: "beginner",
    tags: ["scaffold"],
    files: [
      {
        name: "contract.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// ─── Ledger state (public, on-chain) ───────────────────────────────────────
// Ledger variables are top-level (no contract {} wrapper in Compact).
// Use export for SDK-readable state, sealed for immutable metadata.
//
// export ledger count: Counter;
// export ledger owner: ZswapCoinPublicKey;
// export ledger data: Map<ZswapCoinPublicKey, Uint<128>>;
// export ledger items: Set<Bytes<32>>;
// export sealed ledger name: Opaque<"string">;

// ─── Private witnesses ─────────────────────────────────────────────────────
// Witnesses are private inputs provided by the caller's wallet — never on-chain.
// Declare as function signatures: witness fnName(): ReturnType;
//
// witness mySecret(): Bytes<32>;
// witness myChoice(): Boolean;

// ─── Constructor ───────────────────────────────────────────────────────────
// Runs once at deployment. Not a ZK circuit.
constructor() {
  // owner = ownPublicKey();
  // name = "My Contract";
}

// ─── Circuits ─────────────────────────────────────────────────────────────
// Each exported circuit produces a ZK proof when called.
//
// Key rules:
//  - assert(condition, "message")  — parentheses required
//  - disclose(value)               — required when writing params/witnesses to ledger
//  - Enum/bool literals            — no disclose needed
//  - Counter: .increment(n)        — no disclose needed
//  - No variable-length loops      — only for...of over Vector<N, T>
//
// export circuit doSomething(param: Uint<64>): [] {
//   assert(param > 0, "Must be positive");
//   count.increment(param);
// }
`,
      },
    ],
  },
};

// ─── Pre-loaded sample projects (beginner-friendly only) ──────────────────────

export const SAMPLE_PROJECTS: Array<{
  id: string;
  name: string;
  description: string;
  template: TemplateKey;
  updatedAt: number;
}> = [
  {
    id: "proj_1",
    name: "Hello, Midnight!",
    description: "Store a public string on-chain. The simplest possible Compact contract.",
    template: "hello-world",
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "proj_2",
    name: "Counter",
    description: "On-chain counter using the built-in Counter type and increment().",
    template: "counter",
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "proj_3",
    name: "Anonymous Voting",
    description: "ZK voting: who voted is public, what they voted stays private.",
    template: "voting",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

export const MOCK_WALLET = {
  address: "0x742d35Cc6634C0532925a3b8D4C9b5A15e8c3a4",
  balance: "12.847 DUST",
  network: "Midnight Devnet",
  connected: false,
};
