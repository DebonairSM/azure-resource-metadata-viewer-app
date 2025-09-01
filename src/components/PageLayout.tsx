import React from 'react';
import { Container } from 'react-bootstrap';
import { useIsAuthenticated } from '@azure/msal-react';
import { SignInButton } from './SignInButton';
import { SignOutButton } from './SignOutButton';
import { UserProfile } from './UserProfile';

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();

  return (
    <>
      <div className="sophisticated-header">
        <Container>
          <div className="header-content">
            <div className="header-brand">
              <h1 className="header-title">Azure Resource Metadata Viewer</h1>
            </div>
            <div className="header-actions">
              {isAuthenticated ? (
                <>
                  <UserProfile />
                  <SignOutButton />
                </>
              ) : (
                <SignInButton />
              )}
            </div>
          </div>
        </Container>
      </div>
      
      <div className="main-content">
        {children}
      </div>
    </>
  );
};
