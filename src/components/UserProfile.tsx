import { useState } from 'react';
import { useMsal } from '@azure/msal-react';

export const UserProfile: React.FC = () => {
  const { accounts } = useMsal();
  const [isOpen, setIsOpen] = useState(false);
  const account = accounts[0];

  if (!account) {
    return null;
  }

  const displayName = account.name || account.username || 'User';
  const email = account.username || '';

  return (
    <div className="user-profile-container">
      <button 
        className="user-profile-button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      >
        <div className="user-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="user-name">{displayName}</span>
      </button>
      
      {isOpen && (
        <div className="user-profile-dropdown">
          <div className="user-info">
            <div className="user-info-item">
              <small className="user-info-label">Signed in as</small>
              <div className="user-info-value">{email}</div>
            </div>
            <div className="user-info-item">
              <small className="user-info-label">Account ID</small>
              <div className="user-info-value">
                <code>{account.localAccountId}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
