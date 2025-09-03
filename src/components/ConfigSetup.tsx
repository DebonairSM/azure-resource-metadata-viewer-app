import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';

interface ConfigSetupProps {
  onConfigComplete: (clientId: string, tenantId?: string) => void;
}

export const ConfigSetup: React.FC<ConfigSetupProps> = ({ onConfigComplete }) => {
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Predefined company configurations
  const companyConfigs = {
    'signature': {
      name: 'Signature Aviation',
      clientId: '9c63ee73-3247-487e-b850-78f8658aa6c1',
      tenantId: 'common' // Will be updated with actual tenant ID
    },
    'grandetech': {
      name: 'Grande Tech',
      clientId: '', // Will need to be configured
      tenantId: 'common' // Will be updated with actual tenant ID
    }
  };

  // Check if we have a client ID from environment
  useEffect(() => {
    const envClientId = import.meta.env.VITE_AZURE_CLIENT_ID;
    const envTenantId = import.meta.env.VITE_AZURE_TENANT_ID;
    if (envClientId && envClientId !== 'your-client-id-here') {
      setClientId(envClientId);
      setTenantId(envTenantId || 'common');
      setIsValid(true);
      onConfigComplete(envClientId, envTenantId);
    }
  }, [onConfigComplete]);

  const handleCompanySelect = (companyKey: string) => {
    const config = companyConfigs[companyKey as keyof typeof companyConfigs];
    if (config) {
      setSelectedCompany(companyKey);
      setClientId(config.clientId);
      setTenantId(config.tenantId);
      setIsValid(validateClientId(config.clientId));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onConfigComplete(clientId, tenantId);
    }
  };

  const validateClientId = (value: string) => {
    // Basic GUID validation
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
  };

  const handleClientIdChange = (value: string) => {
    setClientId(value);
    setIsValid(validateClientId(value));
  };

  return (
    <div className="container mt-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card>
            <Card.Header>
              <h4 className="mb-0">Azure Configuration</h4>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-4">
                Select your company or enter your Azure AD App Registration details to get started.
              </p>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Select Company (Optional)</Form.Label>
                  <Form.Select 
                    value={selectedCompany} 
                    onChange={(e) => handleCompanySelect(e.target.value)}
                  >
                    <option value="">Choose a company...</option>
                    {Object.entries(companyConfigs).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Pre-configured company settings will auto-fill the fields below.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Azure AD Client ID</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={clientId}
                    onChange={(e) => handleClientIdChange(e.target.value)}
                    isInvalid={clientId.length > 0 && !isValid}
                    isValid={clientId.length > 0 && isValid}
                  />
                  <Form.Text className="text-muted">
                    This is the Application (client) ID from your Azure AD app registration.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Tenant ID (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="common or specific-tenant-id"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    Use 'common' for multi-tenant apps, or specific tenant ID for single-tenant apps.
                  </Form.Text>
                </Form.Group>

                <div className="d-grid gap-2">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    disabled={!isValid}
                    size="lg"
                  >
                    Continue to Sign In
                  </Button>
                  
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => setShowHelp(!showHelp)}
                  >
                    {showHelp ? 'Hide' : 'Show'} Setup Instructions
                  </Button>
                </div>
              </Form>

              {showHelp && (
                <Alert variant="info" className="mt-4">
                  <h6>How to get your Client ID:</h6>
                  <ol>
                    <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer">Azure Portal</a></li>
                    <li>Navigate to <strong>Azure Active Directory</strong> → <strong>App registrations</strong></li>
                    <li>Click <strong>"New registration"</strong></li>
                    <li>Configure:
                      <ul>
                        <li><strong>Name:</strong> "Azure Resource Viewer"</li>
                        <li><strong>Supported account types:</strong> "Accounts in any organizational directory" (for multi-tenant)</li>
                        <li><strong>Redirect URI:</strong> <code>http://localhost:5173/</code></li>
                      </ul>
                    </li>
                    <li>Click <strong>"Register"</strong></li>
                    <li>Copy the <strong>Application (client) ID</strong> from the Overview page</li>
                    <li>Go to <strong>API permissions</strong> and add:
                      <ul>
                        <li><strong>Microsoft Graph:</strong> User.Read, Directory.Read.All</li>
                        <li><strong>Azure Service Management:</strong> user_impersonation</li>
                      </ul>
                    </li>
                    <li>Click <strong>"Grant admin consent"</strong></li>
                  </ol>
                  
                  <hr />
                  
                  <h6 className="text-warning">⚠️ Authentication Issues:</h6>
                  <p className="mb-2">
                    <strong>Common Problems:</strong>
                  </p>
                  <ul>
                    <li><strong>Bypassed Sign-in:</strong> Browser is using cached credentials</li>
                    <li><strong>Wrong Tenant:</strong> App registration doesn't exist in target tenant</li>
                    <li><strong>Permission Issues:</strong> Missing API permissions or admin consent</li>
                  </ul>
                  
                  <p className="mb-2">
                    <strong>Quick Fixes:</strong>
                  </p>
                  <ul>
                    <li>Clear browser cache and cookies</li>
                    <li>Sign out of all Azure accounts in your browser</li>
                    <li>Use incognito/private browsing mode</li>
                    <li>Create a new multi-tenant app registration</li>
                  </ul>
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
