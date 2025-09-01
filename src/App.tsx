import { useState, useCallback } from 'react';
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalInstance } from './auth/msalConfig';
import { PageLayout } from './components/PageLayout';
import { Dashboard } from './components/Dashboard';
import { SignInButton } from './components/SignInButton';
import { ConfigSetup } from './components/ConfigSetup';

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function AppRoot() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [currentMsalInstance, setCurrentMsalInstance] = useState(msalInstance);

  const handleConfigComplete = useCallback(async (newClientId: string) => {
    setClientId(newClientId);
    // Create a new MSAL instance with the provided client ID
    const newConfig = {
      auth: {
        clientId: newClientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'localStorage' as const,
        storeAuthStateInCookie: false,
      },
    };
    const newInstance = new PublicClientApplication(newConfig);
    
    // Initialize the new MSAL instance
    try {
      await newInstance.initialize();
      console.log('New MSAL instance initialized successfully');
      setCurrentMsalInstance(newInstance);
    } catch (error) {
      console.error('Failed to initialize new MSAL instance:', error);
    }
  }, []);

  // If no client ID is configured, show the setup screen
  if (!clientId) {
    return <ConfigSetup onConfigComplete={handleConfigComplete} />;
  }

  return (
    <MsalProvider instance={currentMsalInstance}>
      <PageLayout>
        <AuthenticatedTemplate>
          <Dashboard />
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
          <div className="text-center">
            <h2>Welcome to Azure Resource Metadata Viewer</h2>
            <p className="lead mb-4">
              Sign in with your Microsoft account to view and manage Azure resources across multiple tenants.
            </p>
            <SignInButton />
          </div>
        </UnauthenticatedTemplate>
      </PageLayout>
    </MsalProvider>
  );
}

export default AppRoot;
