import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div>
              <p className="header-eyebrow">Encrypted workspace</p>
              <h1 className="header-title">DataCipher</h1>
            </div>
            <div className="header-pill">FHE-ready</div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
