import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { forceFreshAuthentication } from '../auth/msalConfig';

export const UserProfile: React.FC = () => {
  const { accounts, instance } = useMsal();
  const [isOpen, setIsOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [tenantInfo, setTenantInfo] = useState<{id: string, name: string} | null>(null);
  const account = accounts[0];

  if (!account) {
    return null;
  }

  const displayName = account.name || account.username || 'User';
  const email = account.username || '';

  // Extract permissions and tenant info from account claims
  useEffect(() => {
    if (account && account.idTokenClaims) {
      const claims = account.idTokenClaims as any;
      const extractedPermissions: string[] = [];
      
      // Extract tenant information
      if (claims.tid) {
        setTenantInfo({
          id: claims.tid,
          name: claims.iss?.includes('common') ? 'Multi-Tenant' : claims.tfp || 'Unknown Tenant'
        });
      }
      
      // Extract roles from claims
      if (claims.roles) {
        extractedPermissions.push(...claims.roles);
      }
      
      // Extract groups from claims
      if (claims.groups) {
        extractedPermissions.push(...claims.groups.map((group: string) => `Group: ${group}`));
      }
      
      // Extract tenant roles
      if (claims.tenant_roles) {
        extractedPermissions.push(...claims.tenant_roles);
      }
      
      // If no specific permissions found, show basic access
      if (extractedPermissions.length === 0) {
        extractedPermissions.push('Basic User Access');
      }
      
      setPermissions(extractedPermissions);
    }
  }, [account]);

  const handleSwitchTenant = async () => {
    await forceFreshAuthentication();
    // Trigger fresh sign in with account selection to allow switching between tenants
    const loginRequest = {
      scopes: ['https://management.azure.com/user_impersonation', 'User.Read', 'Directory.Read.All'],
      prompt: 'select_account',
      extraQueryParameters: {
        // Force account selection to allow switching between different tenant accounts
        prompt: 'select_account'
      }
    };
    
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await instance.logoutPopup();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

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
            
            {tenantInfo && (
              <div className="user-info-item">
                <small className="user-info-label">Tenant</small>
                <div className="user-info-value">
                  <div className="tenant-info">
                    <span className="tenant-name">{tenantInfo.name}</span>
                    <small className="tenant-id text-muted">
                      <code>{tenantInfo.id}</code>
                    </small>
                  </div>
                </div>
              </div>
            )}
            
            <div className="user-info-item">
              <small className="user-info-label">Account ID</small>
              <div className="user-info-value">
                <code>{account.localAccountId}</code>
              </div>
            </div>
            
            <div className="user-info-item">
              <small className="user-info-label">Permissions & Roles</small>
              <div className="user-info-value">
                <div className="permissions-list">
                  {permissions.map((permission, index) => (
                    <span key={index} className="permission-badge">
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="user-actions">
            <button 
              className="btn btn-outline-primary btn-sm w-100 mb-2"
              onClick={handleSwitchTenant}
            >
              🔄 Switch Tenant/Account
            </button>
            <button 
              className="btn btn-outline-danger btn-sm w-100"
              onClick={handleSignOut}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
