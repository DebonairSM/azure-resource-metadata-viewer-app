import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { azureAccountManager } from '../api/azureAccounts';
import { msalInstance, ARM_SCOPE } from '../auth/msalConfig';

export const UserProfile: React.FC = () => {
  const { accounts, instance } = useMsal();
  const [isOpen, setIsOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [tenantInfo, setTenantInfo] = useState<{id: string, name: string} | null>(null);
  const [loadingTenantInfo, setLoadingTenantInfo] = useState(false);
  const account = accounts[0];

  if (!account) {
    return null;
  }

  const displayName = account.name || account.username || 'User';
  const email = account.username || '';

  // Extract permissions and fetch real tenant info
  useEffect(() => {
    if (account && account.idTokenClaims) {
      const claims = account.idTokenClaims as any;
      const extractedPermissions: string[] = [];
      
      // Extract roles from claims
      if (claims.roles && claims.roles.length > 0) {
        extractedPermissions.push(...claims.roles);
      }
      
      // Extract groups from claims
      if (claims.groups && claims.groups.length > 0) {
        extractedPermissions.push(...claims.groups.map((group: string) => `Group: ${group}`));
      }
      
      // Extract tenant roles
      if (claims.tenant_roles && claims.tenant_roles.length > 0) {
        extractedPermissions.push(...claims.tenant_roles);
      }
      
      // Only set permissions if we actually have some
      // Don't show fake/placeholder permissions
      
      setPermissions(extractedPermissions);

      // Fetch real tenant information from Azure API
      if (claims.tid) {
        fetchRealTenantInfo(claims.tid);
      }
    }
  }, [account]);

  const fetchRealTenantInfo = async (tenantId: string) => {
    if (!account) return;
    
    setLoadingTenantInfo(true);
    try {
      const armToken = await msalInstance.acquireTokenSilent({ account, scopes: [ARM_SCOPE] });
      const tenants = await azureAccountManager.getTenants(armToken.accessToken);
      const tenant = tenants.find(t => t.id === tenantId);
      
      if (tenant && tenant.displayName && tenant.displayName !== 'Unknown Tenant') {
        setTenantInfo({
          id: tenant.id,
          name: tenant.displayName
        });
      } else {
        // Only set tenant info if we have a meaningful name
        setTenantInfo(null);
      }
    } catch (error) {
      console.error('Failed to fetch tenant info:', error);
      setTenantInfo(null);
    } finally {
      setLoadingTenantInfo(false);
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
                  <span className="tenant-name">{tenantInfo.name}</span>
                </div>
              </div>
            )}
            
            {loadingTenantInfo && (
              <div className="user-info-item">
                <small className="user-info-label">Tenant</small>
                <div className="user-info-value">
                  <span className="text-muted">Loading tenant info...</span>
                </div>
              </div>
            )}
            
            {permissions.length > 0 && (
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
            )}
          </div>
          
          <div className="user-actions">
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
