import { useCallback, useMemo, useState, useEffect } from 'react';
import { 
  Form, 
  Button, 
  Table, 
  Alert, 
  Spinner, 
  Badge, 
  Card,
  Row,
  Col,
  Dropdown,
  DropdownButton
} from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import type { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { msalInstance, ARM_SCOPE, GRAPH_SCOPES } from '../auth/msalConfig';
import { fetchAllOwnerRoleAssignments, fetchAllResources, parseResourceGroupFromId } from '../api/arm';
import { getPrincipalsByIds } from '../api/graph';
import { azureAccountManager, type AzureSubscription, type AzureTenant } from '../api/azureAccounts';

interface ResourceItem {
  id: string;
  name: string;
  type: string;
  resourceGroup?: string;
  location?: string;
  tags?: Record<string, string>;
  owners?: string[];
}

async function acquireTokenSilentOrPopup(account: AccountInfo, scopes: string[]): Promise<AuthenticationResult> {
  try {
    return await msalInstance.acquireTokenSilent({ account, scopes });
  } catch {
    return await msalInstance.acquireTokenPopup({ account, scopes });
  }
}

export const Dashboard: React.FC = () => {
  const { accounts } = useMsal();
  const account = accounts[0];
  
  // State for Azure account management
  const [tenants, setTenants] = useState<AzureTenant[]>([]);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<AzureTenant | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<AzureSubscription | null>(null);
  
  // State for resource querying
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);

  const canQuery = useMemo(() => !!selectedSubscription && !!account, [selectedSubscription, account]);

  // Load Azure accounts and subscriptions on component mount
  useEffect(() => {
    if (account) {
      loadAzureAccounts();
    }
  }, [account]);

  // Load Azure accounts and subscriptions
  const loadAzureAccounts = async () => {
    if (!account) return;
    
    setLoadingAccounts(true);
    setError(null);
    
    try {
      const armToken = await acquireTokenSilentOrPopup(account, [ARM_SCOPE]);
      
      // Load both tenants and subscriptions
      const [tenantsData, subscriptionsData] = await Promise.all([
        azureAccountManager.getTenants(armToken.accessToken),
        azureAccountManager.getSubscriptions(armToken.accessToken)
      ]);
      
      setTenants(tenantsData);
      setSubscriptions(subscriptionsData);
      
      // Auto-select first tenant and subscription if available
      if (tenantsData.length > 0 && !selectedTenant) {
        setSelectedTenant(tenantsData[0]);
      }
      
      if (subscriptionsData.length > 0 && !selectedSubscription) {
        setSelectedSubscription(subscriptionsData[0]);
      }
      
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load Azure accounts';
      
      // Provide more helpful error messages for common issues
      if (errorMessage.includes('403') || errorMessage.includes('authorization')) {
        setError(`Permission denied: ${errorMessage}\n\nTo fix this:\n1. Go to Azure Portal → Subscriptions → Access control (IAM)\n2. Add "Reader" role assignment for your user\n3. Or ask your Azure administrator for access`);
      } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        setError(`Authentication failed: ${errorMessage}\n\nPlease sign out and sign in again to refresh your credentials.`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Handle tenant selection
  const handleTenantChange = (tenant: AzureTenant) => {
    setSelectedTenant(tenant);
    setSelectedSubscription(null); // Reset subscription when tenant changes
    setItems([]); // Clear previous results
  };

  // Handle subscription selection
  const handleSubscriptionChange = (subscription: AzureSubscription) => {
    setSelectedSubscription(subscription);
    setItems([]); // Clear previous results
  };

  // Get subscriptions for selected tenant
  const getSubscriptionsForSelectedTenant = useMemo(() => {
    if (!selectedTenant) return [];
    return subscriptions.filter(sub => sub.tenantId === selectedTenant.id);
  }, [selectedTenant, subscriptions]);

  const onQuery = useCallback(async () => {
    if (!canQuery || !account || !selectedSubscription) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const armToken = await acquireTokenSilentOrPopup(account, [ARM_SCOPE]);
      const [resources, ownerAssignments] = await Promise.all([
        fetchAllResources(selectedSubscription.id, armToken.accessToken),
        fetchAllOwnerRoleAssignments(selectedSubscription.id, armToken.accessToken),
      ]);

      const principalIds = ownerAssignments.map(r => r.properties.principalId).filter(Boolean);

      // Try Graph, but proceed if not permitted
      let principalIdToName: Record<string, { displayName?: string }> = {};
      try {
        const graphToken = await acquireTokenSilentOrPopup(account, GRAPH_SCOPES);
        principalIdToName = await getPrincipalsByIds(graphToken.accessToken, principalIds);
      } catch {
        principalIdToName = {};
      }

      const scopeToOwners = new Map<string, string[]>();
      for (const ra of ownerAssignments) {
        const id = ra.properties.principalId;
        if (!id) continue;
        const name = principalIdToName[id]?.displayName || id;
        const list = scopeToOwners.get(ra.properties.scope) || [];
        list.push(name);
        scopeToOwners.set(ra.properties.scope, list);
      }

      const withOwners = resources.map(r => {
        const resourceGroup = parseResourceGroupFromId(r.id);
        const owners = scopeToOwners.get(r.id) || scopeToOwners.get(`/subscriptions/${selectedSubscription.id}`) || [];
        return { 
          id: r.id, 
          name: r.name, 
          type: r.type, 
          location: r.location, 
          resourceGroup, 
          tags: r.tags, 
          owners 
        };
      });

      setItems(withOwners);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      
      // Provide more helpful error messages for common issues
      if (errorMessage.includes('403') || errorMessage.includes('authorization')) {
        setError(`Permission denied: ${errorMessage}\n\nTo fix this:\n1. Go to Azure Portal → Subscriptions → Access control (IAM)\n2. Add "Reader" role assignment for your user\n3. Or ask your Azure administrator for access`);
      } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        setError(`Authentication failed: ${errorMessage}\n\nPlease sign out and sign in again to refresh your credentials.`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [account, canQuery, selectedSubscription]);

  const renderTags = (tags?: Record<string, string>) => {
    if (!tags || Object.keys(tags).length === 0) {
      return <span className="text-muted">—</span>;
    }

    return (
      <div className="d-flex flex-wrap gap-1">
        {Object.entries(tags).map(([k, v]) => (
          <Badge key={k} bg="secondary" className="text-wrap">
            {k}: {v}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Azure Account Selection */}
      <Card className="mb-4">
        <Card.Header>
          <h4 className="mb-0">Azure Account Selection</h4>
        </Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Tenant (Company)</Form.Label>
                <DropdownButton
                  variant="outline-secondary"
                  title={selectedTenant ? selectedTenant.displayName : 'Select Tenant'}
                  disabled={loadingAccounts || tenants.length === 0}
                  className="w-100"
                >
                  {tenants.length === 0 ? (
                    <Dropdown.Item disabled>
                      <em>No tenants available. Click "Refresh" to load.</em>
                    </Dropdown.Item>
                  ) : (
                    tenants.map((tenant) => (
                      <Dropdown.Item 
                        key={tenant.id} 
                        onClick={() => handleTenantChange(tenant)}
                        active={selectedTenant?.id === tenant.id}
                      >
                        <div>
                          <strong>{tenant.displayName}</strong>
                          <br />
                          <small className="text-muted">{tenant.defaultDomain}</small>
                        </div>
                      </Dropdown.Item>
                    ))
                  )}
                </DropdownButton>
              </Form.Group>
            </Col>
            
            <Col md={4}>
              <Form.Group>
                <Form.Label>Subscription</Form.Label>
                <DropdownButton
                  variant="outline-secondary"
                  title={selectedSubscription ? selectedSubscription.name : 'Select Subscription'}
                  disabled={loadingAccounts || !selectedTenant || getSubscriptionsForSelectedTenant.length === 0}
                  className="w-100"
                >
                  {getSubscriptionsForSelectedTenant.map((subscription) => (
                    <Dropdown.Item 
                      key={subscription.id} 
                      onClick={() => handleSubscriptionChange(subscription)}
                      active={selectedSubscription?.id === subscription.id}
                    >
                      <div>
                        <strong>{subscription.name}</strong>
                        <br />
                        <small className="text-muted">
                          {subscription.id} • {subscription.state}
                          {subscription.isDefault && <Badge bg="primary" className="ms-2">Default</Badge>}
                        </small>
                      </div>
                    </Dropdown.Item>
                  ))}
                </DropdownButton>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Button 
                variant="outline-primary" 
                onClick={loadAzureAccounts}
                disabled={loadingAccounts}
                className="w-100"
              >
                {loadingAccounts ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Loading...
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </Col>
            
            <Col md={2}>
              <Button 
                variant="primary" 
                onClick={onQuery} 
                disabled={!canQuery || loading}
                className="w-100"
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Loading...
                  </>
                ) : (
                  'Query Resources'
                )}
              </Button>
            </Col>
          </Row>
          
          {error && (
            <Alert variant="danger" className="mt-3">
              <strong>Error:</strong> {error}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Resource Results */}
      {items.length > 0 && (
        <Card>
          <Card.Header>
            <h5 className="mb-0">
              Resources in {selectedSubscription?.name} ({items.length})
            </h5>
            <small className="text-muted">
              Tenant: {selectedTenant?.displayName} • Subscription ID: {selectedSubscription?.id}
            </small>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table striped hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Resource Group</th>
                    <th>Location</th>
                    <th>Owners</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        <code>{item.type}</code>
                      </td>
                      <td>
                        {item.resourceGroup ? (
                          <Badge bg="info">{item.resourceGroup}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {item.location ? (
                          <Badge bg="secondary">{item.location}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {item.owners && item.owners.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {item.owners.map((owner, index) => (
                              <Badge key={index} bg="success" className="border border-success text-success bg-transparent">
                                {owner}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        {renderTags(item.tags)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {items.length === 0 && !loading && !error && selectedSubscription && (
        <Card>
          <Card.Body className="text-center text-muted">
            <p className="mb-0">No resources found in {selectedSubscription.name}. Click "Query Resources" to get started.</p>
          </Card.Body>
        </Card>
      )}

      {!selectedSubscription && !loading && !error && (
        <Card>
          <Card.Body className="text-center text-muted">
            <p className="mb-0">Please select a tenant and subscription to query Azure resources.</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};
