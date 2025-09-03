import { useState, useCallback } from 'react';
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalInstance } from './auth/msalConfig';
import { PageLayout } from './components/PageLayout';
import { Dashboard } from './components/Dashboard';
import { ConfigSetup } from './components/ConfigSetup';

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function AppRoot() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [currentMsalInstance, setCurrentMsalInstance] = useState(msalInstance);

  const handleConfigComplete = useCallback(async (newClientId: string, newTenantId?: string) => {
    setClientId(newClientId);
    
    // Create a new MSAL instance with the provided client ID and tenant
    const authority = newTenantId && newTenantId !== 'common' 
      ? `https://login.microsoftonline.com/${newTenantId}`
      : 'https://login.microsoftonline.com/common';
    
    const newConfig = {
      auth: {
        clientId: newClientId,
        authority: authority,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'localStorage' as const,
        storeAuthStateInCookie: false,
        secureCookies: false,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: any, message: string, containsPii: boolean) => {
            if (containsPii) {
              return;
            }
            console.log(`[MSAL ${level}] ${message}`);
          },
          logLevel: 0 // LogLevel.Verbose
        }
      }
    };
    const newInstance = new PublicClientApplication(newConfig);
    
    // Initialize the new MSAL instance
    try {
      await newInstance.initialize();
      console.log(`New MSAL instance initialized successfully with authority: ${authority}`);
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
          <div className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title">Welcome to Azure Resource Metadata Viewer</h1>
              <p className="hero-description">
                Sign in with your Microsoft account to view and manage Azure resources across multiple tenants.
              </p>
            </div>
          </div>
        </UnauthenticatedTemplate>
      </PageLayout>
    </MsalProvider>
  );
}

export default AppRoot;
