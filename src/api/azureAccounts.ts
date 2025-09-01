export interface AzureSubscription {
  id: string;
  name: string;
  tenantId: string;
  state: string;
  isDefault: boolean;
}

export interface AzureTenant {
  id: string;
  displayName: string;
  defaultDomain: string;
}

export class AzureAccountManager {
  private static instance: AzureAccountManager;
  private subscriptions: AzureSubscription[] = [];
  private tenants: AzureTenant[] = [];

  static getInstance(): AzureAccountManager {
    if (!AzureAccountManager.instance) {
      AzureAccountManager.instance = new AzureAccountManager();
    }
    return AzureAccountManager.instance;
  }

  async getSubscriptions(accessToken: string): Promise<AzureSubscription[]> {
    try {
      const url = 'https://management.azure.com/subscriptions?api-version=2020-01-01';
      console.log(`Making API request to: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Subscriptions API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to fetch subscriptions: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      this.subscriptions = data.value.map((sub: any) => ({
        id: sub.subscriptionId,
        name: sub.displayName,
        tenantId: sub.tenantId,
        state: sub.state,
        isDefault: sub.isDefault || false,
      }));

      return this.subscriptions;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  async getTenants(accessToken: string): Promise<AzureTenant[]> {
    try {
      const url = 'https://management.azure.com/tenants?api-version=2020-01-01';
      console.log(`Making API request to: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tenants API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to fetch tenants: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      this.tenants = data.value.map((tenant: any) => ({
        id: tenant.tenantId,
        displayName: tenant.displayName || 'Unknown Tenant',
        defaultDomain: tenant.defaultDomain || '',
      }));

      return this.tenants;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  }

  getSubscriptionsByTenant(tenantId: string): AzureSubscription[] {
    return this.subscriptions.filter(sub => sub.tenantId === tenantId);
  }

  getCurrentSubscriptions(): AzureSubscription[] {
    return this.subscriptions;
  }

  getCurrentTenants(): AzureTenant[] {
    return this.tenants;
  }

  findSubscriptionById(subscriptionId: string): AzureSubscription | undefined {
    return this.subscriptions.find(sub => sub.id === subscriptionId);
  }

  findTenantById(tenantId: string): AzureTenant | undefined {
    return this.tenants.find(tenant => tenant.id === tenantId);
  }
}

export const azureAccountManager = AzureAccountManager.getInstance();
