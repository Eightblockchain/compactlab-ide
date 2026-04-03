// Mock Compact language templates
export const COMPACT_TEMPLATES = {
  counter: {
    name: "Counter",
    description: "Simple counter with increment and decrement circuits",
    code: `pragma language_version >= 0.14.0;

import CompactStandardLibrary;

// A simple counter contract demonstrating basic Compact patterns
contract Counter {
  
  // Ledger state: the counter value (public)
  ledger counter: Uint<32>;

  // Initialize the counter to zero
  constructor() {
    counter = 0;
  }

  // Increment the counter by a given amount
  // The amount is a witness (private input)
  export circuit increment(amount: Uint<32>): [] {
    counter = counter + amount;
  }

  // Decrement the counter (with underflow protection)
  export circuit decrement(amount: Uint<32>): [] {
    assert counter >= amount, "Counter underflow";
    counter = counter - amount;
  }

  // Reset counter to zero (admin circuit)
  export circuit reset(): [] {
    counter = 0;
  }

  // Read current counter value
  export circuit getCount(): Uint<32> {
    return counter;
  }
}
`,
  },
  
  voting: {
    name: "Private Voting",
    description: "Zero-knowledge voting system with private ballots",
    code: `pragma language_version >= 0.14.0;

import CompactStandardLibrary;

// Private voting contract using ZK proofs
// Voters can cast ballots without revealing their choice publicly
contract PrivateVoting {

  // Public ledger state
  ledger votesFor: Uint<64>;
  ledger votesAgainst: Uint<64>;
  ledger totalVoters: Uint<64>;
  ledger votingOpen: Boolean;

  // Witness: the secret vote and voter commitment
  witness voterSecret: Bytes<32>;
  witness voteChoice: Boolean;  // true = for, false = against

  constructor() {
    votesFor = 0;
    votesAgainst = 0;
    totalVoters = 0;
    votingOpen = true;
  }

  // Cast a private vote using ZK proof
  // The circuit proves vote validity without revealing the choice
  export circuit castVote(
    voterCommitment: Bytes<32>
  ): [] {
    assert votingOpen, "Voting is closed";
    
    // ZK: prove commitment matches witness
    const computedCommitment = hash(voterSecret);
    assert computedCommitment == voterCommitment, "Invalid commitment";
    
    // Record vote privately
    if voteChoice {
      votesFor = votesFor + 1;
    } else {
      votesAgainst = votesAgainst + 1;
    }
    totalVoters = totalVoters + 1;
  }

  // Close voting (admin only)
  export circuit closeVoting(): [] {
    votingOpen = false;
  }

  // Get results (only after voting closes)
  export circuit getResults(): [Uint<64>, Uint<64>] {
    assert !votingOpen, "Voting still in progress";
    return [votesFor, votesAgainst];
  }
}
`,
  },
  
  token: {
    name: "Private Token",
    description: "Confidential token transfer with hidden balances",
    code: `pragma language_version >= 0.14.0;

import CompactStandardLibrary;

// Confidential token contract
// Balances are private; transfers use ZK proofs
contract PrivateToken {

  // Only total supply is public
  ledger totalSupply: Uint<128>;
  ledger name: Bytes<32>;
  ledger symbol: Bytes<8>;

  // Private: individual balances (commitment scheme)
  witness senderBalance: Uint<128>;
  witness receiverBalance: Uint<128>;
  witness transferAmount: Uint<128>;
  witness senderSecret: Bytes<32>;
  witness receiverSecret: Bytes<32>;

  constructor(
    tokenName: Bytes<32>,
    tokenSymbol: Bytes<8>,
    initialSupply: Uint<128>
  ) {
    name = tokenName;
    symbol = tokenSymbol;
    totalSupply = initialSupply;
  }

  // Transfer tokens privately
  // Proves: sender has enough balance, balances update correctly
  // Reveals: nothing about amounts or parties
  export circuit transfer(
    senderCommitment: Bytes<32>,
    receiverCommitment: Bytes<32>,
    newSenderCommitment: Bytes<32>,
    newReceiverCommitment: Bytes<32>
  ): [] {
    // Verify sender has sufficient balance
    assert senderBalance >= transferAmount, "Insufficient balance";
    
    // Verify commitment integrity
    const computedSender = hash(senderSecret, senderBalance);
    assert computedSender == senderCommitment, "Invalid sender proof";
    
    const computedReceiver = hash(receiverSecret, receiverBalance);
    assert computedReceiver == receiverCommitment, "Invalid receiver proof";
    
    // Verify new commitments are correct
    const newSenderBal = senderBalance - transferAmount;
    const newReceiverBal = receiverBalance + transferAmount;
    
    assert hash(senderSecret, newSenderBal) == newSenderCommitment;
    assert hash(receiverSecret, newReceiverBal) == newReceiverCommitment;
  }

  // Mint new tokens (increases total supply)
  export circuit mint(amount: Uint<128>): [] {
    totalSupply = totalSupply + amount;
  }
}
`,
  },

  blank: {
    name: "Blank Contract",
    description: "Start from scratch",
    code: `pragma language_version >= 0.14.0;

import CompactStandardLibrary;

contract MyContract {
  
  // Define your ledger state here
  // ledger myValue: Uint<32>;

  constructor() {
    // Initialize state
  }

  // Add your circuits here
  // export circuit myCircuit(): [] {
  //   // Circuit logic
  // }
}
`,
  },
};

export const SAMPLE_PROJECTS = [
  { id: "proj_1", name: "Counter Demo", template: "counter", updatedAt: Date.now() - 1000 * 60 * 30 },
  { id: "proj_2", name: "Private Voting", template: "voting", updatedAt: Date.now() - 1000 * 60 * 60 * 2 },
  { id: "proj_3", name: "Confidential Token", template: "token", updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
];

export const MOCK_WALLET = {
  address: "0x742d35Cc6634C0532925a3b8D4C9b5A15e8c3a4",
  balance: "12.847 DUST",
  network: "Midnight Devnet",
  connected: false,
};
