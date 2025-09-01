import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { clearMsalCache } from '../auth/msalConfig';

export const SignOutButton: React.FC = () => {
  const { instance, accounts } = useMsal();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = (logoutType: 'popup' | 'redirect') => {
    if (logoutType === 'popup') {
      instance.logoutPopup({
        account: accounts[0],
        postLogoutRedirectUri: window.location.origin,
        mainWindowRedirectUri: window.location.origin,
      });
    } else if (logoutType === 'redirect') {
      instance.logoutRedirect({
        account: accounts[0],
        postLogoutRedirectUri: window.location.origin,
      });
    }
  };

  const handleClearCache = async () => {
    await clearMsalCache();
    // Reload the page to ensure clean state
    window.location.reload();
  };

  return (
    <div className="signout-container">
      <button 
        className="signout-button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      >
        Sign Out
      </button>
      
      {isOpen && (
        <div className="signout-dropdown">
          <button 
            className="signout-option"
            onClick={() => handleLogout('popup')}
          >
            Sign out using Popup
          </button>
          <button 
            className="signout-option"
            onClick={() => handleLogout('redirect')}
          >
            Sign out using Redirect
          </button>
          <div className="signout-divider"></div>
          <button 
            className="signout-option signout-clear"
            onClick={handleClearCache}
          >
            Clear Cache & Reload
          </button>
        </div>
      )}
    </div>
  );
};
