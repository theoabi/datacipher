# DataCipher

DataCipher is an encrypted on-chain database built on Zama FHEVM. It lets users store numeric data privately while still
keeping all writes and reads verifiable on Ethereum testnets. Each database owns an encrypted key on-chain and every
stored entry is encrypted with that key, so plaintext values never appear in contract storage or events.

## Overview

On-chain data is public by default, which blocks many real-world use cases that require confidentiality. DataCipher uses
Fully Homomorphic Encryption (FHE) to make private storage possible without off-chain custody or trusted servers.

At a high level:
- A user creates a database by generating a random EVM address, encrypting it with the Zama relayer, and storing the
  encrypted key alongside a database name on-chain.
- When using the database, the user decrypts the encrypted key locally (after relayer authorization) and uses it to
  encrypt numeric inputs.
- The contract verifies the encrypted key matches the stored encrypted key using FHE equality, then stores the encrypted
  value.
- When reading, the user decrypts the encrypted entries locally using the same key.

## Problems Solved

- Public on-chain storage makes sensitive data unusable for many applications.
- Off-chain encryption typically requires trusted databases or key custody services.
- Traditional access control can leak data through metadata or revert logic.
- Application teams need a transparent audit trail without exposing private values.

## Why DataCipher Works

- FHE encryption lets the contract compare encrypted values without seeing plaintext.
- Each database has its own encrypted key, so compromises do not cascade to other databases.
- Only the owner can write to a database, and incorrect encrypted keys resolve to encrypted zero instead of plaintext
  leakage.
- The owner still controls when and where decryption happens, keeping trust and responsibility client-side.

## Advantages

- Privacy-first storage with on-chain verifiability.
- No plaintext values stored in contract state or emitted in events.
- Deterministic access gating using encrypted key matching.
- Minimal trust surface: encryption and decryption happen client-side with the Zama relayer.
- Simple data model that is easy to audit and integrate into frontends.

## Tech Stack

Smart contracts:
- Solidity 0.8.27
- Hardhat + hardhat-deploy
- Zama FHEVM (@fhevm/solidity) and Hardhat plugin

Frontend:
- React + Vite
- viem for contract reads
- ethers v6 for contract writes
- RainbowKit + wagmi for wallet connection
- No Tailwind CSS (plain CSS or component-level styles only)

Tooling:
- TypeScript
- TypeChain
- ESLint + Prettier
- Solidity coverage

## Architecture and Data Flow

Data model (on-chain):
- Database name: plaintext string
- Database owner: plaintext address
- Database key: encrypted eaddress
- Entries: encrypted euint32 values

Lifecycle:
1. Create database
   - Client generates random EVM address A.
   - Client encrypts A via the relayer.
   - Contract stores encrypted A and database name.
2. Unlock database
   - Client decrypts the encrypted key A locally via the relayer.
3. Add entry
   - Client encrypts a uint32 value with key A.
   - Contract checks encrypted key equality.
   - If key matches, encrypted value is stored; if not, encrypted zero is stored.
4. Read entries
   - Client reads encrypted entries from chain.
   - Client decrypts entries locally using key A.

## Smart Contract Details

Contract: `contracts/DataCipher.sol`

Key functions:
- `createDatabase(name, encryptedKey, inputProof)` creates a database and stores the encrypted key.
- `addEntry(databaseId, encryptedValue, encryptedKey, inputProof)` verifies the encrypted key and stores the value.
- `getDatabase(databaseId)` returns name, owner, and entry count.
- `getDatabaseKey(databaseId)` returns the encrypted key.
- `getEntries(databaseId)` returns encrypted entries.
- `getEntry(databaseId, index)` returns a single encrypted entry.
- `getDatabaseIds(owner)` returns database ids owned by an address.
- `databaseCount()` returns total databases created.

Events:
- `DatabaseCreated(databaseId, owner, name)`
- `EntryAdded(databaseId, owner, index)`

Notes:
- Only the database owner can add entries.
- Entries are stored as encrypted uint32 values.
- Metadata (name, owner, entry count) remains public on-chain.
- Incorrect keys do not revert the transaction; they store encrypted zero instead.

## Frontend Rules and Integration

This repo requires the frontend to follow these constraints:
- Read-only calls use viem; write calls use ethers v6.
- Do not use localhost RPC for the frontend; target Sepolia.
- Do not use localStorage in the frontend.
- Do not use environment variables in the frontend.
- Do not import JSON files directly in the frontend.
- Keep frontend isolated from root-level files (no cross-imports).

ABI usage:
- Copy the ABI from `deployments/sepolia/DataCipher.json` into a TypeScript module inside the frontend.
- Keep the contract address in a TypeScript constant (not in env vars).

## Repository Structure

```
.
├── contracts/           # Solidity contracts
├── deploy/              # Deployment scripts
├── deployments/         # Network deployment artifacts (ABI + address)
├── docs/                # Zama docs references
├── tasks/               # Hardhat tasks for DB flows
├── test/                # Contract tests
├── frontend/            # React + Vite frontend
└── hardhat.config.ts    # Hardhat configuration
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm 7+

### Install Dependencies

Root dependencies:
```bash
npm install
```

Frontend dependencies:
```bash
cd frontend
npm install
```

### Compile and Test (Contracts)

```bash
npm run compile
npm run test
```

### Local Contract Workflow (for development only)

```bash
npm run chain
npm run deploy:localhost
```

### Sepolia Deployment

Create a `.env` file at the repo root:
```
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

Notes:
- Use a single private key (no mnemonic).
- The config reads `process.env.PRIVATE_KEY` and `process.env.INFURA_API_KEY`.

Deploy and verify:
```bash
npm run deploy:sepolia
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

### Hardhat Tasks

These tasks use the FHEVM CLI helpers for encryption and decryption.

```bash
npx hardhat task:db-address --network sepolia
npx hardhat task:db-info --id 0 --network sepolia
npx hardhat task:db-create --name "My DB" --network sepolia
npx hardhat task:db-decrypt-key --id 0 --network sepolia
npx hardhat task:db-add-entry --id 0 --key 0x... --value 42 --network sepolia
npx hardhat task:db-entries --id 0 --network sepolia
```

### Run the Frontend

```bash
cd frontend
npm run dev
```

Build and preview:
```bash
npm run build
npm run preview
```

## Security and Privacy Considerations

- The database name, owner, and entry count are public metadata.
- Encrypted data confidentiality relies on the FHEVM scheme and relayer authorization.
- Treat the decrypted database key like a password; do not reuse it across databases.
- Incorrect encrypted keys write encrypted zero, which avoids revealing failure details.
- This project is not audited; use with caution in production contexts.

## Known Limitations

- Only uint32 values are supported for encrypted entries.
- No pagination for large entry sets.
- No deletion or update of entries (append-only).
- Database name is plaintext; consider keeping it non-sensitive.
- Access control is owner-only; no sharing or role delegation yet.

## Future Roadmap

- Encrypted metadata (name and tags).
- Multi-user sharing with re-encryption flows.
- Pagination and indexing for large datasets.
- Support for additional numeric types and structured payloads.
- UI improvements for key management and backup.
- Optional off-chain indexing layer for faster reads (without revealing plaintext).
- Formal audit and security review.

## Documentation

- Zama contract references: `docs/zama_llm.md`
- Zama relayer integration: `docs/zama_doc_relayer.md`

## License

BSD-3-Clause-Clear. See `LICENSE`.
