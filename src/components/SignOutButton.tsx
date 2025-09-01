import React from 'react';
import { DropdownButton, Dropdown } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import { clearMsalCache } from '../auth/msalConfig';

export const SignOutButton: React.FC = () => {
  const { instance, accounts } = useMsal();

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
    <DropdownButton
      variant="outline-light"
      className="ms-2"
      drop="start"
      title="Sign Out"
    >
      <Dropdown.Item as="button" onClick={() => handleLogout('popup')}>
        Sign out using Popup
      </Dropdown.Item>
      <Dropdown.Item as="button" onClick={() => handleLogout('redirect')}>
        Sign out using Redirect
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item as="button" onClick={handleClearCache}>
        🗑️ Clear Cache & Reload
      </Dropdown.Item>
    </DropdownButton>
  );
};
