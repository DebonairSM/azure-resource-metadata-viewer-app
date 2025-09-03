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
// import { MultiAccountSelector } from './MultiAccountSelector';
// import { multiAccountManager, type TenantAccount } from '../auth/multiAccountManager';

interface ResourceItem {
  id: string;
  name: string;
  type: string;
  resourceGroup?: string;
  location?: string;
  tags?: Record<string, string>;
  owners?: string[];
}

// Helper functions to generate Azure portal URLs
const generateAzurePortalUrl = (resourceId: string, action?: string): string => {
  const baseUrl = 'https://portal.azure.com';
  
  if (action === 'delete') {
    return `${baseUrl}/#@/resource${resourceId}/delete`;
  }
  
  return `${baseUrl}/#@/resource${resourceId}`;
};

const generateResourceGroupUrl = (subscriptionId: string, resourceGroupName: string): string => {
  const baseUrl = 'https://portal.azure.com';
  const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}`;
  return `${baseUrl}/#@/resource${resourceId}`;
};

// Helper function to extract subscription ID from resource ID
const extractSubscriptionIdFromResourceId = (resourceId: string): string | null => {
  const match = resourceId.match(/\/subscriptions\/([^\/]+)/);
  return match ? match[1] : null;
};

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
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<AzureSubscription[]>([]);
  
  // State for resource querying
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  
  // State for filtering
  const [globalSearch, setGlobalSearch] = useState('');
  const [subscriptionSearchTerm, setSubscriptionSearchTerm] = useState('');
  
  // State for view mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const canQuery = useMemo(() => selectedSubscriptions.length > 0 && !!account, [selectedSubscriptions, account]);

  // Filter items based on global search
  const filteredItems = useMemo(() => {
    if (!globalSearch.trim()) {
      return items;
    }

    const searchTerm = globalSearch.toLowerCase();
    
    return items.filter(item => {
      // Search in basic fields
      const matchesName = item.name.toLowerCase().includes(searchTerm);
      const matchesType = item.type.toLowerCase().includes(searchTerm);
      const matchesResourceGroup = item.resourceGroup?.toLowerCase().includes(searchTerm) || false;
      const matchesLocation = item.location?.toLowerCase().includes(searchTerm) || false;
      
      // Search in owners
      const matchesOwners = item.owners?.some(owner => 
        owner.toLowerCase().includes(searchTerm)
      ) || false;
      
      // Search in tags (both keys and values)
      const matchesTags = item.tags ? Object.entries(item.tags).some(([key, value]) => 
        key.toLowerCase().includes(searchTerm) || value.toLowerCase().includes(searchTerm)
      ) : false;
      
      return matchesName || matchesType || matchesResourceGroup || matchesLocation || matchesOwners || matchesTags;
    });
  }, [items, globalSearch]);

  // Clear filters when new data is loaded
  const clearFilters = () => {
    setGlobalSearch('');
  };

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
      
      // Auto-select first tenant if none selected
      if (tenantsData.length > 0 && !selectedTenant) {
        const firstTenant = tenantsData[0];
        setSelectedTenant(firstTenant);
        
        // Auto-select first subscription for the first tenant
        const tenantSubscriptions = subscriptionsData.filter(sub => sub.tenantId === firstTenant.id);
        if (tenantSubscriptions.length > 0) {
          setSelectedSubscriptions([tenantSubscriptions[0]]);
        }
      } else if (selectedTenant) {
        // Update selected subscriptions to only include those from the current tenant
        const tenantSubscriptions = subscriptionsData.filter(sub => sub.tenantId === selectedTenant.id);
        const validSubscriptions = selectedSubscriptions.filter(sub => 
          tenantSubscriptions.some(ts => ts.id === sub.id)
        );
        if (validSubscriptions.length === 0 && tenantSubscriptions.length > 0) {
          setSelectedSubscriptions([tenantSubscriptions[0]]);
        } else {
          setSelectedSubscriptions(validSubscriptions);
        }
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
    setItems([]); // Clear previous results
    
    // Auto-select first subscription for the new tenant
    const tenantSubscriptions = subscriptions.filter(sub => sub.tenantId === tenant.id);
    if (tenantSubscriptions.length > 0) {
      setSelectedSubscriptions([tenantSubscriptions[0]]);
    } else {
      setSelectedSubscriptions([]);
    }
  };

  // Handle subscription selection
  const handleSubscriptionChange = (subscription: AzureSubscription) => {
    setSelectedSubscriptions(prev => {
      const isSelected = prev.some(sub => sub.id === subscription.id);
      if (isSelected) {
        // Remove subscription if already selected
        return prev.filter(sub => sub.id !== subscription.id);
      } else {
        // Add subscription if not selected
        return [...prev, subscription];
      }
    });
    setItems([]); // Clear previous results
  };

  // Handle select all subscriptions
  const handleSelectAllSubscriptions = () => {
    const allSubscriptions = getSubscriptionsForSelectedTenant;
    const allSelected = allSubscriptions.every(sub => 
      selectedSubscriptions.some(selected => selected.id === sub.id)
    );
    
    if (allSelected) {
      // Deselect all
      setSelectedSubscriptions([]);
    } else {
      // Select all
      setSelectedSubscriptions([...allSubscriptions]);
    }
    setItems([]); // Clear previous results
  };

  // Get subscriptions for selected tenant
  const getSubscriptionsForSelectedTenant = useMemo(() => {
    if (!selectedTenant) return subscriptions; // Show all subscriptions if no tenant selected
    return subscriptions.filter(sub => sub.tenantId === selectedTenant.id);
  }, [selectedTenant, subscriptions]);

  // Filter subscriptions based on search term
  const filteredSubscriptions = useMemo(() => {
    if (!subscriptionSearchTerm.trim()) return getSubscriptionsForSelectedTenant;
    
    const searchLower = subscriptionSearchTerm.toLowerCase();
    return getSubscriptionsForSelectedTenant.filter(sub => 
      sub.name.toLowerCase().includes(searchLower) ||
      sub.id.toLowerCase().includes(searchLower)
    );
  }, [getSubscriptionsForSelectedTenant, subscriptionSearchTerm]);

  const onQuery = useCallback(async () => {
    if (!canQuery || !account || selectedSubscriptions.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const armToken = await acquireTokenSilentOrPopup(account, [ARM_SCOPE]);
      
      // Query all selected subscriptions in parallel
      const subscriptionPromises = selectedSubscriptions.map(async (subscription) => {
        const [resources, ownerAssignments] = await Promise.all([
          fetchAllResources(subscription.id, armToken.accessToken),
          fetchAllOwnerRoleAssignments(subscription.id, armToken.accessToken),
        ]);
        return { subscription, resources, ownerAssignments };
      });

      const subscriptionResults = await Promise.all(subscriptionPromises);

      // Collect all principal IDs from all subscriptions
      const allPrincipalIds = subscriptionResults
        .flatMap(result => result.ownerAssignments.map(r => r.properties.principalId))
        .filter(Boolean);

      // Try Graph, but proceed if not permitted
      let principalIdToName: Record<string, { displayName?: string }> = {};
      try {
        const graphToken = await acquireTokenSilentOrPopup(account, GRAPH_SCOPES);
        principalIdToName = await getPrincipalsByIds(graphToken.accessToken, allPrincipalIds);
      } catch {
        principalIdToName = {};
      }

      // Process all resources from all subscriptions
      const allResources: ResourceItem[] = [];
      
      for (const { subscription, resources, ownerAssignments } of subscriptionResults) {
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
          const owners = scopeToOwners.get(r.id) || scopeToOwners.get(`/subscriptions/${subscription.id}`) || [];
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

        allResources.push(...withOwners);
      }

      setItems(allResources);
      clearFilters(); // Clear filters when new data is loaded
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
  }, [account, canQuery, selectedSubscriptions]);

  const renderTags = (tags?: Record<string, string>) => {
    if (!tags || Object.keys(tags).length === 0) {
      return <span className="text-muted">—</span>;
    }

    return (
      <div className="d-flex flex-wrap gap-1">
        {Object.entries(tags).map(([k, v]) => (
          <Badge key={k} bg="secondary" className="text-wrap">
            <strong>{k}:</strong> {v}
          </Badge>
        ))}
      </div>
    );
  };

  const renderTagsForCards = (tags?: Record<string, string>) => {
    if (!tags || Object.keys(tags).length === 0) {
      return <span className="text-muted">—</span>;
    }

    return (
      <div className="d-flex flex-wrap gap-1">
        {Object.entries(tags).map(([k, v]) => (
          <Badge key={k} bg="secondary" className="card-tag-badge">
            <strong>{k}:</strong> {v}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Azure Account Selection */}
      <Card className="mb-4 azure-account-section">
        <Card.Header>
          <h4 className="mb-0">Azure Account Selection</h4>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Tenant</Form.Label>
                <DropdownButton
                  variant="outline-secondary"
                  title={
                    loadingAccounts ? (
                      <span>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Loading...
                      </span>
                    ) : selectedTenant ? (
                      <div className="text-start">
                        <div className="fw-bold">{selectedTenant.displayName}</div>
                        <small className="text-muted">{selectedTenant.defaultDomain}</small>
                      </div>
                    ) : (
                      'Select Tenant'
                    )
                  }
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
                        disabled={loadingAccounts}
                      >
                        <div>
                          <div className="d-flex align-items-center">
                            <strong>{tenant.displayName}</strong>
                            {selectedTenant?.id === tenant.id && (
                              <Badge bg="success" className="ms-2">Current</Badge>
                            )}
                          </div>
                          <small className="text-muted">{tenant.defaultDomain}</small>
                        </div>
                      </Dropdown.Item>
                    ))
                  )}
                </DropdownButton>
                {selectedTenant && (
                  <small className="text-muted">
                    Currently viewing: <strong>{selectedTenant.displayName}</strong>
                  </small>
                )}
              </Form.Group>
            </Col>
            
            <Col md={5}>
              <Form.Group>
                <Form.Label>
                  Subscriptions ({selectedSubscriptions.length} selected)
                </Form.Label>
                <div className="subscription-selector">
                  {getSubscriptionsForSelectedTenant.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      <em>No subscriptions available. Select a tenant first.</em>
                    </div>
                  ) : (
                    <>
                      {/* Search Box */}
                      <div className="mb-3">
                        <Form.Control
                          type="text"
                          placeholder="Search subscriptions..."
                          value={subscriptionSearchTerm}
                          onChange={(e) => setSubscriptionSearchTerm(e.target.value)}
                          className="subscription-search-input"
                        />
                      </div>

                      {/* Quick Actions Bar */}
                      <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                        <div className="d-flex align-items-center gap-2">
                          <Form.Check
                            type="checkbox"
                            id="select-all-subscriptions"
                            label={<strong>Select All</strong>}
                            checked={filteredSubscriptions.every(sub => 
                              selectedSubscriptions.some(selected => selected.id === sub.id)
                            )}
                            onChange={handleSelectAllSubscriptions}
                            className="mb-0"
                          />
                          <Badge bg="secondary">
                            {filteredSubscriptions.length} {subscriptionSearchTerm ? 'filtered' : 'total'}
                          </Badge>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <Badge bg="success">
                            {selectedSubscriptions.length} selected
                          </Badge>
                        </div>
                      </div>

                      {/* Compact Subscription Grid */}
                      <div className="subscription-grid">
                        {filteredSubscriptions.length === 0 ? (
                          <div className="text-muted text-center py-3">
                            <em>No subscriptions match your search.</em>
                          </div>
                        ) : (
                          filteredSubscriptions.map((subscription) => (
                            <div 
                              key={subscription.id}
                              className={`subscription-card ${selectedSubscriptions.some(sub => sub.id === subscription.id) ? 'selected' : ''}`}
                              onClick={() => handleSubscriptionChange(subscription)}
                            >
                              <div className="d-flex align-items-start justify-content-between">
                                <div className="flex-grow-1">
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <Form.Check
                                      type="checkbox"
                                      checked={selectedSubscriptions.some(sub => sub.id === subscription.id)}
                                      onChange={() => {}} // Handled by parent click
                                      className="mb-0"
                                    />
                                    <strong className="subscription-name">{subscription.name}</strong>
                                    {subscription.isDefault && (
                                      <Badge bg="primary" className="small">Default</Badge>
                                    )}
                                  </div>
                                  <div className="subscription-details">
                                    <small 
                                      className="text-muted d-block subscription-id"
                                      title={`Full ID: ${subscription.id}`}
                                    >
                                      <strong>ID:</strong> {subscription.id}
                                    </small>
                                    <Badge 
                                      bg={subscription.state === 'Enabled' ? 'success' : 'warning'} 
                                      className="small"
                                    >
                                      {subscription.state}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Form.Group>
            </Col>
            
            <Col md={4}>
              <div className="d-flex flex-column gap-2 h-100">
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
                
                <Button 
                  variant="primary" 
                  onClick={onQuery} 
                  disabled={!canQuery || loading}
                  className="w-100 query-resources-btn"
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
              </div>
            </Col>
          </Row>
          
          {error && (
            <Alert variant="danger" className="mt-3">
              <strong>Error:</strong> {error}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Resource Results - Always render to prevent layout shift */}
      <Card className="results-section">
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">
                {items.length > 0 ? (
                  <>Resources from {selectedSubscriptions.length} subscription{selectedSubscriptions.length !== 1 ? 's' : ''} ({filteredItems.length} of {items.length})</>
                ) : (
                  <>Resource Results</>
                )}
              </h5>
              {items.length > 0 && selectedTenant && (
                <div className="d-flex align-items-center gap-2">
                  <Badge bg="primary" className="d-flex align-items-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    {selectedTenant.displayName}
                  </Badge>
                  <small className="text-muted">
                    Subscriptions: {selectedSubscriptions.map(sub => sub.name).join(', ')}
                  </small>
                </div>
              )}
            </Col>
            {items.length > 0 && (
              <Col xs="auto">
                <div className="d-flex gap-3 align-items-center">
                  <div className="view-toggle-group">
                    <Button 
                      variant={viewMode === 'table' ? 'primary' : 'outline-secondary'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className={viewMode === 'table' ? 'active' : ''}
                    >
                      Table
                    </Button>
                    <Button 
                      variant={viewMode === 'cards' ? 'primary' : 'outline-secondary'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className={viewMode === 'cards' ? 'active' : ''}
                    >
                      Cards
                    </Button>
                  </div>
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    onClick={clearFilters}
                    disabled={!globalSearch.trim()}
                  >
                    Clear Search
                  </Button>
                </div>
              </Col>
            )}
          </Row>
        </Card.Header>
        <Card.Body>
          {items.length > 0 ? (
            <>
              {/* Global Search */}
              <div className="search-section mb-4">
                <div className="search-container">
                  <div className="search-input-wrapper">
                    <Form.Control
                      type="text"
                      placeholder="Search resources..."
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="search-input"
                    />
                    {globalSearch && (
                      <button 
                        className="search-clear-btn"
                        onClick={() => setGlobalSearch('')}
                        title="Clear"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Results Display */}
              {viewMode === 'table' ? (
                <div className="table-responsive">
                  <Table className="mb-0 table-sm">
                    <thead>
                      <tr>
                        <th style={{ width: '18%', minWidth: '140px' }}>Name</th>
                        <th style={{ width: '22%', minWidth: '220px' }}>Type</th>
                        <th style={{ width: '15%', minWidth: '130px' }}>Resource Group</th>
                        <th style={{ width: '12%', minWidth: '100px' }}>Location</th>
                        <th style={{ width: '15%', minWidth: '120px' }}>Owners</th>
                        <th style={{ width: '18%', minWidth: '180px' }}>Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div className="text-break" style={{ maxWidth: '300px' }}>
                              <strong 
                                style={{ cursor: 'pointer', color: '#0d6efd' }}
                                onClick={() => {
                                  const url = generateAzurePortalUrl(item.id);
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                title="Click to open resource in Azure Portal"
                              >
                                {item.name}
                              </strong>
                            </div>
                          </td>
                          <td>
                            <div className="text-break" style={{ maxWidth: '250px' }}>
                              <Badge bg="secondary" className="border border-secondary text-secondary bg-transparent small">
                                {item.type}
                              </Badge>
                            </div>
                          </td>
                          <td>
                            {item.resourceGroup ? (
                              <Badge 
                                bg="info" 
                                className="text-break small" 
                                style={{ cursor: 'pointer', whiteSpace: 'normal', border: '1px solid #1e40af' }}
                                onClick={() => {
                                  const subscriptionId = extractSubscriptionIdFromResourceId(item.id) || '';
                                  const url = generateResourceGroupUrl(subscriptionId, item.resourceGroup!);
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                title="Click to open Resource Group in Azure Portal"
                              >
                                {item.resourceGroup}
                              </Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {item.location ? (
                              <Badge bg="secondary" className="border border-secondary text-secondary bg-transparent small">{item.location}</Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {item.owners && item.owners.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1">
                                {item.owners.map((owner, index) => (
                                  <Badge key={index} bg="success" className="border border-success text-success bg-transparent text-break small">
                                    {owner}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ maxWidth: '200px' }}>
                              {renderTags(item.tags)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <Row className="g-3">
                  {filteredItems.map(item => (
                    <Col key={item.id} md={6} lg={4}>
                                            <Card className="h-100">
                        <Card.Body>
                          <Card.Title 
                            className="h6 text-break" 
                            style={{ cursor: 'pointer', color: '#0d6efd' }}
                            onClick={() => {
                              const url = generateAzurePortalUrl(item.id);
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            title="Click to open resource in Azure Portal"
                          >
                            {item.name}
                          </Card.Title>
                          <div className="mb-2">
                            <code className="text-primary small">{item.type}</code>
                          </div>
                          <div className="mb-2">
                            {item.resourceGroup && (
                              <Badge 
                                bg="info" 
                                className="me-1 card-resource-group-badge" 
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  const subscriptionId = extractSubscriptionIdFromResourceId(item.id) || '';
                                  const url = generateResourceGroupUrl(subscriptionId, item.resourceGroup!);
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                title="Click to open Resource Group in Azure Portal"
                              >
                                {item.resourceGroup}
                              </Badge>
                            )}
                            {item.location && (
                              <Badge bg="secondary">{item.location}</Badge>
                            )}
                          </div>
                          {item.owners && item.owners.length > 0 && (
                            <div className="mb-2">
                              <small className="text-muted">Owners:</small>
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                {item.owners.map((owner, index) => (
                                  <Badge key={index} bg="success" className="border border-success text-success bg-transparent small">
                                    {owner}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.tags && Object.keys(item.tags).length > 0 && (
                            <div>
                              <small className="text-muted">Tags:</small>
                              <div className="mt-1">
                                {renderTagsForCards(item.tags)}
                              </div>
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}

              {filteredItems.length === 0 && items.length > 0 && (
                <div className="text-center text-muted py-4">
                  <p className="mb-0">No resources match the current filters.</p>
                  <Button variant="link" size="sm" onClick={clearFilters} className="p-0">
                    Clear all filters
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* Empty state content */
            <div className="text-center text-muted py-4">
              {loading ? (
                <div className="d-flex align-items-center justify-content-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  <span>Loading resources...</span>
                </div>
              ) : error ? (
                <div>
                  <p className="mb-0">An error occurred while loading resources.</p>
                  <small>Please try again or check your permissions.</small>
                </div>
              ) : selectedSubscriptions.length > 0 ? (
                <div>
                  <p className="mb-0">No resources found in {selectedSubscriptions.length} selected subscription{selectedSubscriptions.length !== 1 ? 's' : ''}.</p>
                  <small>Click "Query Resources" to get started.</small>
                </div>
              ) : (
                <div>
                  <p className="mb-0">Please select a tenant and subscription to query Azure resources.</p>
                  {tenants.length > 1 && (
                    <small className="text-muted">
                      You have access to {tenants.length} tenants. Use the dropdown above to switch between companies.
                    </small>
                  )}
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};
