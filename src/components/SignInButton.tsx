import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { ARM_SCOPE, GRAPH_SCOPES, forceFreshAuthentication } from '../auth/msalConfig';

export const SignInButton: React.FC = () => {
  const { instance } = useMsal();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogin = async (loginType: 'popup' | 'redirect', forceFresh = false, tenantId?: string) => {
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
      forceRefresh: forceFresh,
      // Add tenant hint if provided
      ...(tenantId && { extraQueryParameters: { tenant: tenantId } })
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
    
    setIsOpen(false);
  };

  return (
    <div className="signin-container">
      <button 
        className="signin-button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      >
        Sign In
      </button>
      
      {isOpen && (
        <div className="signin-dropdown">
          <div className="signin-options">
            <h6>Sign In Options</h6>
            
            <div className="signin-option-group">
              <small className="text-muted">Standard Sign In</small>
              <button 
                className="btn btn-outline-primary btn-sm w-100 mb-2"
                onClick={() => handleLogin('popup', false)}
              >
                🔐 Sign In (Popup)
              </button>
              <button 
                className="btn btn-outline-primary btn-sm w-100 mb-2"
                onClick={() => handleLogin('redirect', false)}
              >
                🔐 Sign In (Redirect)
              </button>
            </div>
            
            <div className="signin-option-group">
              <small className="text-muted">Fresh Authentication</small>
              <button 
                className="btn btn-outline-warning btn-sm w-100 mb-2"
                onClick={() => handleLogin('popup', true)}
              >
                🔄 Fresh Sign In (Popup)
              </button>
              <button 
                className="btn btn-outline-warning btn-sm w-100 mb-2"
                onClick={() => handleLogin('redirect', true)}
              >
                🔄 Fresh Sign In (Redirect)
              </button>
            </div>
            
            <div className="signin-option-group">
              <small className="text-muted">Multi-Tenant Support</small>
              <div className="text-muted small">
                This app supports multiple Azure AD tenants. 
                Use "Fresh Sign In" to select a different account or tenant.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
