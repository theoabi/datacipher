import { useState } from 'react';
import { Contract, Wallet } from 'ethers';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/DatabaseCreate.css';

export function DatabaseCreate() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance, isLoading } = useZamaInstance();

  const [name, setName] = useState('');
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const [databaseKey, setDatabaseKey] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setName('');
    setCreatedId(null);
    setDatabaseKey('');
    setTxHash('');
    setStatusMessage('');
    setError('');
    setCopied(false);
  };

  const copyKey = async () => {
    if (!databaseKey) {
      return;
    }
    await navigator.clipboard.writeText(databaseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!address || !instance || !signerPromise || !publicClient) {
      setError('Connect your wallet and wait for the encryption service to load.');
      return;
    }

    if (!name.trim()) {
      setError('Database name is required.');
      return;
    }

    setIsCreating(true);
    setStatusMessage('Encrypting the database key...');

    try {
      const keyWallet = Wallet.createRandom();
      const keyAddress = keyWallet.address;

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(keyAddress)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer unavailable');
      }

      setStatusMessage('Submitting transaction...');
      const dataCipher = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await dataCipher.createDatabase(
        name.trim(),
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );
      setTxHash(tx.hash);
      await tx.wait();

      const totalCount = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'databaseCount',
      });

      const databaseId = totalCount > 0n ? totalCount - 1n : 0n;
      setCreatedId(databaseId);
      setDatabaseKey(keyAddress);
      setStatusMessage('Database created successfully.');
    } catch (err) {
      console.error('Failed to create database:', err);
      setError(err instanceof Error ? err.message : 'Failed to create database.');
      setStatusMessage('');
    } finally {
      setIsCreating(false);
    }
  };

  if (createdId !== null) {
    return (
      <div className="create-panel">
        <div className="create-success">
          <div>
            <p className="success-title">Database created</p>
            <p className="success-subtitle">Save your key address to encrypt future values.</p>
          </div>
          <div className="success-grid">
            <div className="success-item">
              <span className="success-label">Database ID</span>
              <span className="success-value">{createdId.toString()}</span>
            </div>
            <div className="success-item">
              <span className="success-label">Key address</span>
              <div className="key-row">
                <span className="success-value mono">{databaseKey}</span>
                <button className="ghost-button" type="button" onClick={copyKey}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {txHash ? (
              <div className="success-item">
                <span className="success-label">Transaction</span>
                <span className="success-value mono">{txHash}</span>
              </div>
            ) : null}
          </div>
          <div className="success-actions">
            <button className="secondary-button" type="button" onClick={resetForm}>
              Create another database
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-panel">
      <form className="create-form" onSubmit={handleCreate}>
        <div className="field">
          <label className="field-label" htmlFor="db-name">
            Database name
          </label>
          <input
            id="db-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Payroll vault"
            className="text-input"
            maxLength={48}
          />
        </div>

        {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="create-actions">
          <button className="primary-button" type="submit" disabled={isCreating || isLoading}>
            {isLoading ? 'Loading FHE tools...' : isCreating ? 'Creating...' : 'Create database'}
          </button>
          <p className="helper-text">The key address is generated locally and never stored in your browser.</p>
        </div>
      </form>
    </div>
  );
}
