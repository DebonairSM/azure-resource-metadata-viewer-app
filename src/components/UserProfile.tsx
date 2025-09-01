import { NavDropdown } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';

export const UserProfile: React.FC = () => {
  const { accounts } = useMsal();
  const account = accounts[0];

  if (!account) {
    return null;
  }

  const displayName = account.name || account.username || 'User';
  const email = account.username || '';

  return (
    <NavDropdown
      title={displayName}
      id="user-profile-dropdown"
      className="text-light"
    >
      <NavDropdown.Item disabled>
        <small className="text-muted">Signed in as</small><br />
        <strong>{email}</strong>
      </NavDropdown.Item>
      <NavDropdown.Divider />
      <NavDropdown.Item disabled>
        <small className="text-muted">Account ID</small><br />
        <code className="small">{account.localAccountId}</code>
      </NavDropdown.Item>
    </NavDropdown>
  );
};
