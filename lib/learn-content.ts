/**
 * CompactLab Learn content - grounded in Midnight docs + CompactLab toolchain pins.
 * Claims here should stay citable from midnight-docs or lib/version.ts.
 */

import type { TemplateKey } from "@/lib/constants";
import {
  COMPACT_COMPILER_PACKAGE,
  COMPACT_LANGUAGE_VERSION,
  COMPACT_LANGUAGE_VERSION_FULL,
} from "@/lib/version";

export interface LearnCodeBlock {
  title: string;
  language: "compact" | "typescript" | "bash" | "text";
  code: string;
  /** Short note on where this pattern comes from */
  sourceNote?: string;
}

export interface LearnTopic {
  id: string;
  title: string;
  /** One-line stuck-moment label */
  whenStuck: string;
  concept: string;
  points: string[];
  examples: LearnCodeBlock[];
  /** Template to open via New Project modal */
  tryTemplate?: TemplateKey;
  tryLabel?: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const LEARN_DOCS_HOME = "https://docs.midnight.network/";
export const LEARN_FAUCET_URL = "https://faucet.preprod.midnight.network/";

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: "midnight-compact-zk",
    title: "Midnight, Compact & ZK",
    whenStuck: "What am I building?",
    concept:
      "Midnight is a data-protection blockchain: public state lives on-chain; private state stays local with the user. Compact is Midnight’s smart-contract DSL. The Compact compiler emits zero-knowledge circuits so interactions with the ledger can be proven correct without revealing private inputs. Midnight uses zk-SNARKs (succinct, non-interactive proofs).",
    points: [
      "Public state: on-chain data visible to participants (proofs, contract code, intentionally public fields).",
      "Private state: local/encrypted data never exposed to the network.",
      "Typical flow: compute on private data locally → runtime generates a ZK proof → validators verify → public ledger (and local private state) update.",
      "A zero-knowledge circuit proves a solution exists without revealing the inputs. Compact compiles to ZKIR (ZK intermediate representation) before generating proving/verifying material.",
    ],
    examples: [
      {
        title: "Minimal Compact contract (Hello World pattern)",
        language: "compact",
        sourceNote: "Midnight Hello World tutorial - storeMessage + disclose",
        code: `pragma language_version ${COMPACT_LANGUAGE_VERSION};

import CompactStandardLibrary;

export ledger message: Opaque<"string">;

export circuit storeMessage(newMessage: Opaque<"string">): [] {
  message = disclose(newMessage);
}`,
      },
    ],
    tryTemplate: "hello-world",
    tryLabel: "Create Hello World project",
    docsUrl: "https://docs.midnight.network/what-is-midnight",
    docsLabel: "What is Midnight?",
  },
  {
    id: "pragma-vs-compiler",
    title: "Pragma vs compiler package",
    whenStuck: "0.22 vs +0.30.0 errors",
    concept: `pragma language_version declares which Compact language your source targets. The compiler package is selected separately (for example compact compile +${COMPACT_COMPILER_PACKAGE}). CompactLab pins language ${COMPACT_LANGUAGE_VERSION} / ${COMPACT_LANGUAGE_VERSION_FULL} with compiler package ${COMPACT_COMPILER_PACKAGE}. Do not write pragma language_version ${COMPACT_COMPILER_PACKAGE} - that confuses package with language.`,
    points: [
      `Tutorials use pragma language_version ${COMPACT_LANGUAGE_VERSION} (or >= ${COMPACT_LANGUAGE_VERSION}) to lock the Compact language.`,
      `CLI: compact compile +X.Y.Z … selects an installed compiler package. CompactLab uses +${COMPACT_COMPILER_PACKAGE}.`,
      "Developer tools document language and toolchain as separate: --language-version vs --version on the compiler.",
      `For package ${COMPACT_COMPILER_PACKAGE}, contract-info.json reports language-version ${COMPACT_LANGUAGE_VERSION_FULL} (and a matching runtime version).`,
    ],
    examples: [
      {
        title: "Language pragma (source)",
        language: "compact",
        sourceNote: "Counter / bulletin-board tutorials",
        code: `pragma language_version >= ${COMPACT_LANGUAGE_VERSION};`,
      },
      {
        title: "Compiler package (CLI)",
        language: "bash",
        sourceNote: "Compact developer tools - compile +package",
        code: `compact compile +${COMPACT_COMPILER_PACKAGE} contracts/hello-world.compact contracts/managed/hello-world`,
      },
    ],
    tryTemplate: "counter",
    tryLabel: "Create Counter project",
    docsUrl: "https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage",
    docsLabel: "Compiler usage",
  },
  {
    id: "ledger-export-sealed",
    title: "Ledger, export & sealed",
    whenStuck: "How public state is shaped",
    concept:
      "ledger declarations define the contract’s public on-chain state. export ledger fields are visible outside the contract via the generated TypeScript ledger() API. sealed ledger fields may be written only during initialization (constructor and helpers reachable from the constructor), not from exported circuits.",
    points: [
      "You may declare multiple ledger fields (or none). Each field has a ledger ADT type, or a Compact type (treated as an implicit Cell).",
      "Sugar: for a Compact-typed field x, reading x is like x.read() and x = val is like x.write(val). Counter supports c += / c -= style updates mapped to increment/decrement.",
      "export on a top-level ledger name makes it inspectable through generated ledger().",
      "sealed must appear after optional export and before ledger. It is a static error if a sealed field can be set from code reachable from an exported circuit.",
    ],
    examples: [
      {
        title: "Ledger field forms",
        language: "compact",
        sourceNote: "Compact language reference - public state / sealed",
        code: `ledger val: Field;
export ledger cnt: Counter;
sealed ledger u8list: List<Uint<8>>;
export sealed ledger mapping: Map<Boolean, Field>;`,
      },
      {
        title: "Sealed only in constructor-reachable code",
        language: "compact",
        sourceNote: "Language reference - sealed + constructor",
        code: `sealed ledger field1: Uint<32>;
export sealed ledger field2: Uint<32>;

circuit init(x: Uint<32>): [] {
  field2 = x;
}

constructor(x: Uint<16>) {
  field1 = 2 * x;
  init(x);
}`,
      },
    ],
    tryTemplate: "counter",
    tryLabel: "Create Counter (export ledger)",
    docsUrl: "https://docs.midnight.network/compact/writing",
    docsLabel: "Writing Compact",
  },
  {
    id: "circuits-vs-witnesses",
    title: "Circuits vs witnesses",
    whenStuck: "Private vs enforced logic",
    concept:
      "A circuit is Compact’s operational unit (like a function) with compile-time fixed bounds; exported top-level circuits are contract entry points. A witness has no Compact body - its implementation is supplied in TypeScript/JavaScript by the DApp for private/local state. Witness results must be treated as untrusted.",
    points: [
      "Circuits may be pure or impure. Impure circuits touch the ledger, call impure circuits, or call witnesses.",
      "Witnesses call out to the local DApp; each user/DApp may supply a different implementation.",
      "Confidentiality model: data that is not a ledger field and not an argument/return of a ledger operation stays confidential; computation not done in a witness is enforced correct by the proof.",
      "Effects of witnesses on private state are not recorded in the public ledger. The constructor can also initialize private state through witness calls.",
    ],
    examples: [
      {
        title: "Witness + circuit (ownership pattern)",
        language: "compact",
        sourceNote: "Compact writing tutorial - lock.compact style",
        code: `witness secretKey(): Bytes<32>;

export circuit set(v: Uint<64>): [] {
  assert(state == State.UNSET, "Attempted to set initialized value");
  const sk = secretKey();
  const pk = publicKey(round, sk);
  authority = disclose(pk);
  value = disclose(v);
  state = State.SET;
}`,
      },
      {
        title: "TypeScript witness implementation",
        language: "typescript",
        sourceNote: "Bulletin board tutorial - witnesses file",
        code: `export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [
    BBoardPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};`,
      },
    ],
    tryTemplate: "bulletin-board",
    tryLabel: "Create Bulletin Board",
    docsUrl: "https://docs.midnight.network/compact/writing",
    docsLabel: "Circuits & local state",
  },
  {
    id: "disclose",
    title: "disclose() - when required",
    whenStuck: "Compiler disclosure / witness-protection errors",
    concept:
      "Privacy is the default. Compact requires an explicit disclose(...) before witness-derived (or circuit-/constructor-argument-derived) data may be stored on the public ledger, returned from an exported circuit, or passed to another contract. Wrapping with disclose does not itself publish data - it tells the compiler the disclosure is intentional.",
    points: [
      "Witness data sources: witness returns, exported circuit arguments, constructor arguments, and values derived from them.",
      "Missing disclose → compiler abort with a path from the witness source to the disclosure site (Midnight’s “witness protection program”).",
      "Disclosure also applies to returns from exported circuits when the return expression involves witness-tainted data.",
      "Place disclose close to the disclosure site. For structs, only wrap portions that may contain witness data.",
      "Stdlib note from docs: transientCommit(e) is treated as non-witness for disclosure; transientHash(e) still counts as witness-tainted.",
    ],
    examples: [
      {
        title: "Disclose circuit parameters to ledger",
        language: "compact",
        sourceNote: "Hello World - circuit params are private by default",
        code: `export circuit storeMessage(newMessage: Opaque<"string">): [] {
  message = disclose(newMessage);
}`,
      },
      {
        title: "Disclose witness return to ledger",
        language: "compact",
        sourceNote: "Explicit disclosure reference",
        code: `witness getBalance(): Bytes<32>;
export ledger balance: Bytes<32>;

export circuit recordBalance(): [] {
  balance = disclose(getBalance());
}`,
      },
    ],
    tryTemplate: "hello-world",
    tryLabel: "Create Hello World (practice disclose)",
    docsUrl: "https://docs.midnight.network/compact/reference/explicit-disclosure",
    docsLabel: "Explicit disclosure",
  },
  {
    id: "ledger-adts",
    title: "Ledger ADTs, Opaque & Bytes",
    whenStuck: "Types, Counter/Map/Set, ownership hashes",
    concept:
      "Ledger fields use Compact types or ledger ADTs (Counter, Set, Map, List, Merkle trees, and more). Opaque<\"string\"> / Opaque<\"Uint8Array\"> hold foreign JS values that are opaque inside Compact circuits (hashed) but are not hidden on-chain once stored. Hash-based ownership often uses Bytes<32> with persistentHash - docs note this is not classical public-key cryptography.",
    points: [
      "Counter: increment / decrement (Uint<16> amounts), read → Uint<64>, lessThan, resetToDefault.",
      "Set<T>: insert, remove, member, size, isEmpty, …",
      "Map<K,V>: insert, lookup, member, remove, …; only Map values may nest other ledger state types; nestings must be initialized with default<…> before use.",
      "Opaque tags today: \"string\" and \"Uint8Array\". On-chain UTF-8 / bytes are public once written.",
      "Bytes<n>: fixed-length byte arrays; string literals are Bytes<n>; used heavily with hashing.",
      "Ownership pattern: hash secret + domain separator (+ round/sequence) into Bytes<32>; the ZK proof shows knowledge of the preimage without revealing the secret.",
    ],
    examples: [
      {
        title: "Counter ledger",
        language: "compact",
        sourceNote: "Counter tutorial / CompactLab counter template",
        code: `export ledger round: Counter;

export circuit increment(): [] {
  round.increment(1);
}`,
      },
      {
        title: "Hash “public key” helper",
        language: "compact",
        sourceNote: "Bulletin board tutorial - publicKey helper",
        code: `export circuit publicKey(sk: Bytes<32>, sequence: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([
    pad(32, "bboard:pk:"),
    sequence,
    sk,
  ]);
}`,
      },
    ],
    tryTemplate: "voting",
    tryLabel: "Create Voting (Set + witness)",
    docsUrl: "https://docs.midnight.network/compact/data-types/ledger-adt",
    docsLabel: "Ledger ADTs",
  },
  {
    id: "constructor-vs-circuits",
    title: "Constructor vs circuits",
    whenStuck: "Deploy init vs later calls",
    concept:
      "The optional top-level constructor runs at contract initialization (deploy / initialState). Exported circuits are the ongoing entry points users call in transactions. Sealed fields may only change in constructor-reachable code.",
    points: [
      "At most one constructor; it is top-level only (not inside modules); return type is [].",
      "Use it to initialize public ledger state (and private state via witnesses).",
      "Uninitialized fields get language default values for their type.",
      "Exported circuits may not take generic arguments; exporting the same name twice at top level is a static error.",
      "Generated TypeScript: Contract.initialState(...) runs constructor logic; circuit methods live on circuits / impureCircuits.",
    ],
    examples: [
      {
        title: "Constructor then get circuit",
        language: "compact",
        sourceNote: "Compact writing tutorial",
        code: `constructor(sk: Bytes<32>, v: Uint<64>) {
  authority = disclose(publicKey(round, sk));
  value = disclose(v);
  state = State.SET;
}

export circuit get(): Uint<64> {
  assert(state == State.SET, "Attempted to get uninitialized value");
  return value;
}`,
      },
      {
        title: "Empty constructor (Counter style)",
        language: "compact",
        sourceNote: "CompactLab counter template",
        code: `constructor() {
}`,
      },
    ],
    tryTemplate: "bulletin-board",
    tryLabel: "Create Bulletin Board",
    docsUrl: "https://docs.midnight.network/compact/writing",
    docsLabel: "Constructor & circuits",
  },
  {
    id: "compile-managed",
    title: "Compile & managed artifacts",
    whenStuck: "Typecheck vs deployable ZK",
    concept:
      "compact compile <source> <targetdir> emits JS/TS contract bindings, ZKIR, and (unless skipped) proving/verifying keys. --skip-zk skips proving-key generation for faster debugging of TypeScript output. Modern layouts place outputs under …/managed/<name>/ with compiler/, contract/, keys/, and zkir/.",
    points: [
      "contract/: DApp JS + types (index.js, index.d.ts, …).",
      "keys/: per exported circuit prover/verifier material.",
      "zkir/: ZK intermediate representation for the proof backend.",
      "compiler/: JSON metadata such as contract-info.json (compiler-version, language-version, runtime-version).",
      `In CompactLab: Typecheck ≈ compile with --skip-zk; full Compile (ZK) produces deployable keys under contracts/managed/… using +${COMPACT_COMPILER_PACKAGE}.`,
    ],
    examples: [
      {
        title: "Compile command",
        language: "bash",
        sourceNote: "Counter / Hello World tutorials",
        code: `compact compile +${COMPACT_COMPILER_PACKAGE} \\
  contracts/counter.compact \\
  contracts/managed/counter`,
      },
      {
        title: "Expected managed layout",
        language: "text",
        sourceNote: "Tutorial “Examine the generated files”",
        code: `contracts/managed/counter/
├── contract/     # index.d.ts, index.js, …
├── keys/         # increment.prover / .verifier
├── zkir/         # increment.zkir
└── compiler/     # contract-info.json`,
      },
    ],
    tryTemplate: "hello-world",
    tryLabel: "Create & compile Hello World",
    docsUrl: "https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage",
    docsLabel: "Compiler usage",
  },
  {
    id: "deploy-preprod",
    title: "Preprod deploy & fees",
    whenStuck: "Faucet, tDUST, proving wallet",
    concept:
      "Deploy targets Midnight Preprod. v1 uses Self-pay: fees come from your 1AM tDUST. CompactLab requires the 1AM wallet for proving (getProvingProvider). Flow: Compile (full ZK) then Deploy. Exception: unedited Hello World and Counter ship bundled keys so Deploy works without Compile (you can still Compile if you want).",
    points: [
      "DUST is the shielded fee resource; NIGHT generates DUST. tDUST / tNIGHT are testnet variants.",
      `Faucet: ${LEARN_FAUCET_URL} — fund tNIGHT and wait for tDUST before Deploy.`,
      "A wallet can hold NIGHT and still have zero DUST if the key was never registered for Dust generation.",
      "Docs warn: Not enough Dust generated to pay the fee until DUST accumulates; more NIGHT → faster DUST generation.",
      "Official deploy guides expect managed artifacts under contracts/managed/<name>/{compiler,contract,keys,zkir}.",
      "CompactLab: Connect 1AM on Preprod → Compile (unless using bundled Hello/Counter) → Deploy / Call.",
      "Deploy stays disabled until the project has been compiled for the current source (bundled Instant Deploy templates excepted).",
    ],
    examples: [
      {
        title: "Official tutorial style (outside CompactLab)",
        language: "bash",
        sourceNote: "Hello World / deploy guides - Docker proof server",
        code: `# Official docs often use a local proof server:
npm run start-proof-server
npm run deploy

# CompactLab instead: 1AM wallet proving on Preprod
# Faucet: ${LEARN_FAUCET_URL}`,
      },
    ],
    tryTemplate: "hello-world",
    tryLabel: "Create deployable Hello World",
    docsUrl: "https://docs.midnight.network/getting-started/hello-world",
    docsLabel: "Hello World (deploy)",
  },
  {
    id: "calling-witnesses",
    title: "Calling circuits & witnesses",
    whenStuck: "DApp wiring at call time",
    concept:
      "DApps call exported circuits through the generated TypeScript API. Private state and witness implementations are supplied by the DApp at construction/call time; the Compact runtime passes a WitnessContext into witnesses during proof generation. Circuit arguments are private by default; only disclosed values become public ledger or return data.",
    points: [
      "Empty witnesses object when the Compact file declares no witnesses (Counter tutorial pattern).",
      "Non-empty witnesses: map Compact witness names to TS functions returning [privateState, result].",
      "Contract constructor takes witnesses; impure circuits interact with them.",
      "Runtime type-checks values crossing the Compact↔TypeScript boundary (Field / Uint / Bytes / enum bounds).",
      "In CompactLab: after Compile (ZK) and Deploy, use the Contract panel to send exported circuits with wallet proving.",
    ],
    examples: [
      {
        title: "No Compact witnesses",
        language: "typescript",
        sourceNote: "Counter tutorial",
        code: `export type CounterPrivateState = {
  privateCounter: number;
};

export const witnesses = {};`,
      },
      {
        title: "Generated circuit shape (concept)",
        language: "typescript",
        sourceNote: "Counter tutorial - Circuit types",
        code: `export type Circuits<PS> = {
  increment(
    context: __compactRuntime.CircuitContext<PS>,
  ): __compactRuntime.CircuitResults<PS, []>;
};`,
      },
    ],
    tryTemplate: "counter",
    tryLabel: "Create Counter & call increment",
    docsUrl: "https://docs.midnight.network/tutorials/counter/smart-contract",
    docsLabel: "Counter tutorial",
  },
];

export function getLearnTopic(id: string): LearnTopic | undefined {
  return LEARN_TOPICS.find((t) => t.id === id);
}
