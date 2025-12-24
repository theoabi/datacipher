import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/DatabaseUse.css';

type DecryptedEntry = {
  index: number;
  value: string;
};

export function DatabaseUse() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance } = useZamaInstance();

  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [decryptedKey, setDecryptedKey] = useState('');
  const [isDecryptingKey, setIsDecryptingKey] = useState(false);
  const [entryValue, setEntryValue] = useState('');
  const [isStoring, setIsStoring] = useState(false);
  const [isDecryptingEntries, setIsDecryptingEntries] = useState(false);
  const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[] | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const { data: databaseIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDatabaseIds',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const resolvedIds = useMemo(() => {
    if (!databaseIds) {
      return [];
    }
    return [...databaseIds] as bigint[];
  }, [databaseIds]);

  useEffect(() => {
    if (resolvedIds.length > 0 && selectedId === null) {
      setSelectedId(resolvedIds[0]);
    }
  }, [resolvedIds, selectedId]);

  const { data: databaseInfo } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDatabase',
    args: selectedId !== null ? [selectedId] : undefined,
    query: {
      enabled: selectedId !== null,
    },
  });

  const { data: encryptedKey } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDatabaseKey',
    args: selectedId !== null ? [selectedId] : undefined,
    query: {
      enabled: selectedId !== null,
    },
  });

  const databaseName = databaseInfo ? (databaseInfo[0] as string) : '';
  const databaseOwner = databaseInfo ? (databaseInfo[1] as string) : '';
  const entryCount = databaseInfo ? (databaseInfo[2] as bigint) : 0n;

  const decryptKey = async () => {
    setError('');
    setStatusMessage('');

    if (!instance || !address || !encryptedKey || !signerPromise) {
      setError('Connect your wallet and load the database first.');
      return;
    }

    setIsDecryptingKey(true);
    setStatusMessage('Requesting key decryption...');

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: encryptedKey as string,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer unavailable');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedValue = result[encryptedKey as string];
      if (!decryptedValue) {
        throw new Error('Unable to decrypt the key.');
      }
      setDecryptedKey(decryptedValue);
      setStatusMessage('Key decrypted. You can now encrypt values.');
    } catch (err) {
      console.error('Failed to decrypt key:', err);
      setError(err instanceof Error ? err.message : 'Failed to decrypt key.');
      setStatusMessage('');
    } finally {
      setIsDecryptingKey(false);
    }
  };

  const storeEntry = async () => {
    setError('');
    setStatusMessage('');

    if (!instance || !signerPromise || !publicClient || selectedId === null || !address) {
      setError('Select a database first.');
      return;
    }

    if (!decryptedKey) {
      setError('Decrypt the database key before encrypting values.');
      return;
    }

    const value = parseInt(entryValue, 10);
    if (!Number.isInteger(value) || value < 0) {
      setError('Enter a valid non-negative integer.');
      return;
    }

    setIsStoring(true);
    setStatusMessage('Encrypting and sending value...');

    try {
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, decryptedKey)
        .addAddress(decryptedKey)
        .add32(value)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer unavailable');
      }

      const dataCipher = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await dataCipher.addEntry(
        selectedId,
        encryptedInput.handles[1],
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );
      await tx.wait();

      setEntryValue('');
      setDecryptedEntries(null);
      setStatusMessage('Value stored. Decrypt entries to view.');
    } catch (err) {
      console.error('Failed to store entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to store entry.');
      setStatusMessage('');
    } finally {
      setIsStoring(false);
    }
  };

  const decryptEntries = async () => {
    setError('');
    setStatusMessage('');

    if (!instance || !signerPromise || !publicClient || selectedId === null) {
      setError('Select a database first.');
      return;
    }

    if (!decryptedKey) {
      setError('Decrypt the database key first.');
      return;
    }

    setIsDecryptingEntries(true);
    setStatusMessage('Decrypting entries...');

    try {
      const encryptedEntries = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getEntries',
        args: [selectedId],
      })) as readonly string[];

      if (encryptedEntries.length === 0) {
        setDecryptedEntries([]);
        setStatusMessage('No entries found.');
        return;
      }

      const keypair = instance.generateKeypair();
      const handleContractPairs = encryptedEntries.map((handle) => ({
        handle,
        contractAddress: CONTRACT_ADDRESS,
      }));
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer unavailable');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decrypted = encryptedEntries.map((handle, index) => ({
        index,
        value: `${result[handle]}`,
      }));
      setDecryptedEntries(decrypted);
      setStatusMessage('Entries decrypted.');
    } catch (err) {
      console.error('Failed to decrypt entries:', err);
      setError(err instanceof Error ? err.message : 'Failed to decrypt entries.');
      setStatusMessage('');
    } finally {
      setIsDecryptingEntries(false);
    }
  };

  if (!address) {
    return (
      <div className="use-panel">
        <div className="empty-state">
          <h3>Connect your wallet</h3>
          <p>Connect a wallet to view your databases and decrypt entries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="use-panel">
      <div className="database-list">
        <div className="section-title">Your databases</div>
        {resolvedIds.length === 0 ? (
          <div className="empty-state">
            <p>No databases yet. Create one first.</p>
          </div>
        ) : (
          <div className="database-grid">
            {resolvedIds.map((id) => (
              <button
                key={id.toString()}
                type="button"
                className={`database-pill ${selectedId === id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedId(id);
                  setDecryptedKey('');
                  setDecryptedEntries(null);
                  setStatusMessage('');
                  setError('');
                }}
              >
                Database #{id.toString()}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId !== null ? (
        <div className="database-details">
          <div className="details-card">
            <div className="details-header">
              <div>
                <p className="details-title">{databaseName || 'Untitled database'}</p>
                <p className="details-subtitle mono">Owner: {databaseOwner || '-'}</p>
              </div>
              <div className="details-chip">Entries: {entryCount.toString()}</div>
            </div>

            <div className="key-card">
              <div>
                <p className="section-title">Encrypted key</p>
                <p className="mono small-text">{encryptedKey ? (encryptedKey as string) : 'Loading...'}</p>
              </div>
              <div className="key-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={decryptKey}
                  disabled={isDecryptingKey || !encryptedKey}
                >
                  {isDecryptingKey ? 'Decrypting...' : 'Decrypt key'}
                </button>
                {decryptedKey ? <span className="key-ready">Key ready</span> : null}
              </div>
            </div>

            {decryptedKey ? (
              <div className="key-reveal">
                <span className="section-title">Decrypted key</span>
                <span className="mono">{decryptedKey}</span>
              </div>
            ) : null}

            <div className="entry-form">
              <div>
                <label className="field-label" htmlFor="entry-value">
                  Value to encrypt
                </label>
                <input
                  id="entry-value"
                  className="text-input"
                  placeholder="Enter a number"
                  value={entryValue}
                  onChange={(event) => setEntryValue(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={storeEntry}
                disabled={isStoring}
              >
                {isStoring ? 'Storing...' : 'Encrypt and store'}
              </button>
            </div>

            <div className="entry-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={decryptEntries}
                disabled={isDecryptingEntries}
              >
                {isDecryptingEntries ? 'Decrypting entries...' : 'Decrypt entries'}
              </button>
            </div>

            {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}
            {error ? <div className="error-banner">{error}</div> : null}
          </div>

          <div className="entries-card">
            <div className="section-title">Decrypted entries</div>
            {decryptedEntries === null ? (
              <p className="placeholder-text">Decrypt entries to view stored values.</p>
            ) : decryptedEntries.length === 0 ? (
              <p className="placeholder-text">No entries yet.</p>
            ) : (
              <div className="entries-grid">
                {decryptedEntries.map((entry) => (
                  <div key={`${entry.index}`} className="entry-item">
                    <span className="entry-index">#{entry.index + 1}</span>
                    <span className="entry-value mono">{entry.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
