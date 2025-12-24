import { useState } from 'react';
import { Header } from './Header';
import { DatabaseCreate } from './DatabaseCreate';
import { DatabaseUse } from './DatabaseUse';
import '../styles/DatabaseApp.css';

export function DatabaseApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'use'>('create');

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <section className="hero-card">
          <p className="hero-eyebrow">Private data, public chain</p>
          <h2 className="hero-title">Build encrypted databases with user-held keys.</h2>
          <p className="hero-description">
            Generate a fresh address key, store it encrypted on-chain, and encrypt every value before it reaches
            storage. Decrypt the key when you want to read back the data.
          </p>
          <div className="hero-steps">
            <div className="hero-step">
              <span className="hero-step-number">01</span>
              <div>
                <h3>Create a database</h3>
                <p>Randomize an address key and seal it with FHE.</p>
              </div>
            </div>
            <div className="hero-step">
              <span className="hero-step-number">02</span>
              <div>
                <h3>Decrypt the key</h3>
                <p>Use your wallet to reveal the encrypted address when needed.</p>
              </div>
            </div>
            <div className="hero-step">
              <span className="hero-step-number">03</span>
              <div>
                <h3>Encrypt values</h3>
                <p>Use the decrypted key to encrypt and store numbers.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="tab-bar">
            <button
              className={`tab-button ${activeTab === 'create' ? 'active' : 'inactive'}`}
              onClick={() => setActiveTab('create')}
              type="button"
            >
              Create Database
            </button>
            <button
              className={`tab-button ${activeTab === 'use' ? 'active' : 'inactive'}`}
              onClick={() => setActiveTab('use')}
              type="button"
            >
              Use Database
            </button>
          </div>

          {activeTab === 'create' && <DatabaseCreate />}
          {activeTab === 'use' && <DatabaseUse />}
        </section>
      </main>
    </div>
  );
}
