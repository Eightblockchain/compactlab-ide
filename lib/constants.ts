export type TemplateKey = "counter" | "voting" | "token" | "blank";

export interface TemplateFile {
  name: string;
  language: "compact" | "markdown" | "json";
  content: string;
}

export const COMPACT_TEMPLATES: Record<
  TemplateKey,
  { name: string; description: string; files: TemplateFile[] }
> = {
  counter: {
    name: "Counter",
    description: "On-chain counter using the built-in Counter ledger type",
    files: [
      {
        name: "counter.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// On-chain counter — the canonical Midnight "Hello World".
//
// Key concepts:
//  - export ledger: public on-chain state (visible to all)
//  - Counter: built-in type with a single .increment(n) operation
//  - export circuit: a ZK-provable transition function
//  - constructor(): runs at deploy time, not a ZK circuit

// Public ledger state: the current round/count.
// Counter is append-only — it can only be incremented, never set directly.
export ledger round: Counter;

constructor() {
  // No explicit initialization needed; Counter defaults to 0.
}

// Increment the counter by 1.
// Each call produces a ZK proof that the transition is valid.
export circuit increment(): [] {
  round.increment(1);
}

// Increment by a custom amount.
export circuit incrementBy(amount: Uint<64>): [] {
  round.increment(amount);
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Counter Contract

The simplest possible Midnight contract: an on-chain counter backed by
the built-in \`Counter\` ledger type.

## Language concepts shown

| Concept | Example |
|---|---|
| Language pragma | \`pragma language_version >= 0.20;\` |
| Standard library | \`import CompactStandardLibrary;\` |
| Public ledger state | \`export ledger round: Counter;\` |
| Constructor | \`constructor() { ... }\` |
| Exported circuit | \`export circuit increment(): [] { ... }\` |
| Built-in Counter method | \`round.increment(1);\` |

## Circuits

| Circuit | Parameters | Returns | Description |
|---|---|---|---|
| \`increment\` | — | \`[]\` | Add 1 to the counter |
| \`incrementBy\` | \`amount: Uint<64>\` | \`[]\` | Add any amount |

## Notes

- \`Counter\` is a built-in Compact type — it can only ever go up
- Each circuit call produces a zero-knowledge proof verified on-chain
- The public ledger value \`round\` is readable by anyone via the indexer
`,
      },
    ],
  },

  voting: {
    name: "Anonymous Voting",
    description: "Private ballot system — who voted is public, what they voted is secret",
    files: [
      {
        name: "voting.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Anonymous on-chain voting using zero-knowledge proofs.
//
// Privacy model:
//  - WHO voted is public (ZswapCoinPublicKey stored in a Set — prevents double-voting)
//  - WHAT they voted is PRIVATE (provided as a witness, never revealed)
//  - The ZK proof proves the vote is valid without disclosing the choice
//
// Key concepts:
//  - witness: a private value provided off-chain by the caller
//  - disclose(): required when writing circuit/witness values to the ledger
//  - Set<T>: built-in ledger type for membership tracking
//  - Counter: built-in append-only counter for tallying

export enum VotingState { Open, Closed }

// Public on-chain state
export ledger state: VotingState;
export ledger votesFor: Counter;
export ledger votesAgainst: Counter;
export ledger voters: Set<ZswapCoinPublicKey>;  // tracks participation, not choices

// Private witness: the caller supplies their vote choice off-chain.
// This value is NEVER put on-chain — only its effect on the tally is proven.
witness voteChoice(): Boolean;  // true = For, false = Against

constructor() {
  state = VotingState.Open;
}

// Cast a private vote.
// The ZK proof guarantees a valid choice was made without revealing it.
export circuit castVote(): [] {
  assert(state == VotingState.Open, "Voting is closed");

  const voter = ownPublicKey();
  assert(!voters.member(voter), "Already voted");

  // Record participation publicly (prevents double-voting)
  voters.insert(disclose(voter));

  // Tally the private choice
  const choice = voteChoice();
  if (choice) {
    votesFor.increment(1);
  } else {
    votesAgainst.increment(1);
  }
}

// Close the poll. Any participant can call this after the voting period.
export circuit closeVoting(): [] {
  assert(state == VotingState.Open, "Already closed");
  state = VotingState.Closed;
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Anonymous Voting Contract

A zero-knowledge voting system where ballot choices are provably secret.

## How it works

1. Each voter calls \`castVote()\` and provides their choice **privately** as a witness
2. The contract's ZK circuit proves the vote is valid (binary choice, not double-vote)
3. The on-chain tally updates without any record of who voted which way
4. \`voters\` set tracks participation (prevents double-voting) but not preferences

## Privacy model

| Data | Visibility |
|---|---|
| Who voted | **Public** (stored in \`voters: Set<ZswapCoinPublicKey>\`) |
| Vote choice (For/Against) | **Private** (witness, never on-chain) |
| Running tallies | **Public** (\`votesFor\`, \`votesAgainst\` Counters) |
| Voting status | **Public** (\`state: VotingState\`) |

## Language concepts shown

| Concept | Example |
|---|---|
| Enum | \`export enum VotingState { Open, Closed }\` |
| Set ledger | \`export ledger voters: Set<ZswapCoinPublicKey>;\` |
| Counter ledger | \`export ledger votesFor: Counter;\` |
| Private witness | \`witness voteChoice(): Boolean;\` |
| Caller identity | \`ownPublicKey()\` returns \`ZswapCoinPublicKey\` |
| Explicit disclosure | \`disclose(voter)\` — marks value as going public |
| Assert with message | \`assert(condition, "message")\` |

## Circuits

| Circuit | Returns | Description |
|---|---|---|
| \`castVote\` | \`[]\` | Cast a private ballot (ZK-proven) |
| \`closeVoting\` | \`[]\` | End the voting period |
`,
      },
    ],
  },

  token: {
    name: "Fungible Token",
    description: "ERC-20 style token with public balances mapped to ZswapCoinPublicKey",
    files: [
      {
        name: "token.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// Fungible token with public balances.
//
// Architecture:
//  - Balances are stored in a Map<ZswapCoinPublicKey, Uint<128>>
//  - The deployer receives the entire initial supply at construction
//  - transfer() and mint() demonstrate disclose() and Map manipulation
//
// Key concepts:
//  - Map<K, V>: .member(k), .lookup(k), .insert(k, v), .remove(k), .size()
//  - Uint<N> arithmetic requires explicit disclose() and 'as Uint<N>' casts
//  - sealed ledger: written once in constructor, immutable thereafter
//  - ownPublicKey(): returns the ZswapCoinPublicKey of the transaction caller

// Immutable token metadata (set once in constructor)
export sealed ledger tokenName: Opaque<"string">;
export sealed ledger tokenSymbol: Opaque<"string">;

// Mutable public state
export ledger totalSupply: Uint<128>;
export ledger balances: Map<ZswapCoinPublicKey, Uint<128>>;

constructor() {
  // Set immutable metadata
  tokenName = "MidnightToken";
  tokenSymbol = "MDT";

  // Mint the entire initial supply to the deployer
  const initialSupply: Uint<128> = 1000000;
  totalSupply = initialSupply;
  balances.insert(ownPublicKey(), initialSupply);
}

// Transfer \`amount\` tokens from the caller to \`to\`.
export circuit transfer(to: ZswapCoinPublicKey, amount: Uint<128>): [] {
  const sender = ownPublicKey();

  assert(balances.member(sender), "Sender has no balance");
  const senderBal = balances.lookup(sender);
  assert(senderBal >= amount, "Insufficient balance");

  // Deduct from sender
  balances.insert(disclose(sender), disclose(senderBal - amount as Uint<128>));

  // Credit recipient
  if (balances.member(disclose(to))) {
    const toBalance = balances.lookup(disclose(to));
    balances.insert(disclose(to), disclose(toBalance + amount as Uint<128>));
  } else {
    balances.insert(disclose(to), disclose(amount));
  }
}

// Read the balance of any account.
export circuit balanceOf(account: ZswapCoinPublicKey): Uint<128> {
  if (!balances.member(disclose(account))) {
    return 0;
  }
  return balances.lookup(disclose(account));
}

// Mint new tokens to \`to\` (no access control in this example — add admin check for production).
export circuit mint(to: ZswapCoinPublicKey, amount: Uint<128>): [] {
  const newSupply = totalSupply + amount as Uint<128>;
  totalSupply = disclose(newSupply);

  if (balances.member(disclose(to))) {
    const currentBal = balances.lookup(disclose(to));
    balances.insert(disclose(to), disclose(currentBal + amount as Uint<128>));
  } else {
    balances.insert(disclose(to), disclose(amount));
  }
}
`,
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# Fungible Token Contract

An ERC-20 style token backed by \`Map<ZswapCoinPublicKey, Uint<128>>\`.
Balances are public; all operations produce ZK proofs.

## Architecture

| Ledger | Type | Description |
|---|---|---|
| \`tokenName\` | \`sealed Opaque<"string">\` | Immutable token name |
| \`tokenSymbol\` | \`sealed Opaque<"string">\` | Immutable ticker symbol |
| \`totalSupply\` | \`Uint<128>\` | Total tokens in existence |
| \`balances\` | \`Map<ZswapCoinPublicKey, Uint<128>>\` | Account balances |

## Language concepts shown

| Concept | Example |
|---|---|
| Sealed ledger | \`export sealed ledger tokenName: Opaque<"string">;\` |
| Map ledger | \`export ledger balances: Map<ZswapCoinPublicKey, Uint<128>>;\` |
| Map methods | \`.member(k)\`, \`.lookup(k)\`, \`.insert(k, v)\` |
| Arithmetic cast | \`senderBal - amount as Uint<128>\` |
| Explicit disclosure | \`disclose(sender)\`, \`disclose(newBalance)\` |
| Caller identity | \`ownPublicKey(): ZswapCoinPublicKey\` |

## Circuits

| Circuit | Parameters | Returns | Description |
|---|---|---|---|
| \`transfer\` | \`to: ZswapCoinPublicKey, amount: Uint<128>\` | \`[]\` | Send tokens |
| \`balanceOf\` | \`account: ZswapCoinPublicKey\` | \`Uint<128>\` | Read balance |
| \`mint\` | \`to: ZswapCoinPublicKey, amount: Uint<128>\` | \`[]\` | Create tokens |

## Notes

- Add \`assert(ownPublicKey() == admin, "Not admin")\` to \`mint\` for production use
- Uint<128> arithmetic: always cast back with \`as Uint<128>\` after operations
- \`sealed ledger\` values can only be written in the constructor
`,
      },
    ],
  },

  blank: {
    name: "Blank Contract",
    description: "Empty Compact scaffold with correct syntax ready to build on",
    files: [
      {
        name: "contract.compact",
        language: "compact",
        content: `pragma language_version >= 0.20;

import CompactStandardLibrary;

// ─── Ledger state (public, on-chain) ───────────────────────────────────────
// Ledger variables are declared at the top level (no contract {} wrapper).
// Use \`export\` to make them readable from the TypeScript SDK.
// Use \`sealed\` for values that should only be written once (in the constructor).
//
// export ledger myCounter: Counter;
// export ledger owner: ZswapCoinPublicKey;
// export ledger balances: Map<ZswapCoinPublicKey, Uint<128>>;
// export ledger items: Set<Bytes<32>>;
// export sealed ledger name: Opaque<"string">;

// ─── Private witnesses ─────────────────────────────────────────────────────
// Witnesses are private values provided off-chain by the caller.
// They are NEVER stored on-chain — only their effect is ZK-proven.
// Declare as function signatures: witness fnName(): ReturnType;
//
// witness secretKey(): Bytes<32>;
// witness privateAmount(): Uint<64>;

// ─── Constructor ───────────────────────────────────────────────────────────
// Runs once at deployment. Not a ZK circuit — no disclose() needed.
constructor() {
  // myCounter initializes to 0 by default (Counter type)
  // owner = ownPublicKey();
  // name = "MyContract";
}

// ─── Circuits ─────────────────────────────────────────────────────────────
// Each exported circuit produces a ZK proof when called.
// Rules:
//  - assert(condition, "message") — parentheses required
//  - disclose(value) — required when writing witnessed/param values to ledger
//  - No variable-length loops (only for...of over fixed Vector<N, T>)
//  - Counter uses .increment(n), Map uses .insert/.lookup/.member, Set uses .insert/.member
//
// export circuit doSomething(param: Uint<64>): [] {
//   assert(param > 0, "param must be positive");
//   myCounter.increment(param);
// }
//
// export circuit readOwner(): ZswapCoinPublicKey {
//   return owner;
// }
`,
      },
    ],
  },
};

export const SAMPLE_PROJECTS: Array<{
  id: string;
  name: string;
  description: string;
  template: TemplateKey;
  updatedAt: number;
}> = [
  {
    id: "proj_1",
    name: "Counter",
    description:
      "On-chain counter using the built-in Counter ledger type and a single increment circuit.",
    template: "counter",
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "proj_2",
    name: "Anonymous Voting",
    description:
      "ZK voting: participation is public (prevents double-voting), ballot choice stays private.",
    template: "voting",
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "proj_3",
    name: "Fungible Token",
    description:
      "ERC-20 style token with Map<ZswapCoinPublicKey, Uint<128>> balances and transfer/mint circuits.",
    template: "token",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

export const MOCK_WALLET = {
  address: "0x742d35Cc6634C0532925a3b8D4C9b5A15e8c3a4",
  balance: "12.847 DUST",
  network: "Midnight Devnet",
  connected: false,
};
