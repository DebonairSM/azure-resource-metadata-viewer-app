import React from 'react';
import { DropdownButton, Dropdown } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import { ARM_SCOPE, GRAPH_SCOPES, forceFreshAuthentication } from '../auth/msalConfig';

export const SignInButton: React.FC = () => {
  const { instance } = useMsal();

  const handleLogin = async (loginType: 'popup' | 'redirect', forceFresh = false) => {
    const scopes = [ARM_SCOPE, ...GRAPH_SCOPES];
    
    // Clear cache if forcing fresh authentication
    if (forceFresh) {
      await forceFreshAuthentication();
    }
    
    const loginRequest = {
      scopes,
      // Force account selection and fresh authentication
      prompt: forceFresh ? 'select_account' : undefined,
      // Force fresh token acquisition
      forceRefresh: forceFresh
    };
    
    if (loginType === 'popup') {
      instance.loginPopup(loginRequest).catch((e) => {
        console.error('Login popup failed:', e);
      });
    } else if (loginType === 'redirect') {
      instance.loginRedirect(loginRequest).catch((e) => {
        console.error('Login redirect failed:', e);
      });
    }
  };

  return (
    <DropdownButton
      variant="outline-light"
      className="ms-2"
      drop="start"
      title="Sign In"
    >
      <Dropdown.Item as="button" onClick={() => handleLogin('popup')}>
        Sign in using Popup
      </Dropdown.Item>
      <Dropdown.Item as="button" onClick={() => handleLogin('redirect')}>
        Sign in using Redirect
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item as="button" onClick={() => handleLogin('popup', true)}>
        🔄 Fresh Sign In (Popup)
      </Dropdown.Item>
      <Dropdown.Item as="button" onClick={() => handleLogin('redirect', true)}>
        🔄 Fresh Sign In (Redirect)
      </Dropdown.Item>
    </DropdownButton>
  );
};
