import React from 'react';
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
    <div className="signin-container">
      <button 
        className="signin-button"
        onClick={() => handleLogin('popup')}
      >
        Sign In
      </button>
    </div>
  );
};
