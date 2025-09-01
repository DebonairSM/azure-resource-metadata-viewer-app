import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';

export const UserProfile: React.FC = () => {
  const { accounts } = useMsal();
  const [isOpen, setIsOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const account = accounts[0];

  if (!account) {
    return null;
  }

  const displayName = account.name || account.username || 'User';
  const email = account.username || '';

  // Extract permissions from account claims
  useEffect(() => {
    if (account && account.idTokenClaims) {
      const claims = account.idTokenClaims as any;
      const extractedPermissions: string[] = [];
      
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
        </div>
      )}
    </div>
  );
};
