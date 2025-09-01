# Multi-Tenant Azure Setup Guide

This guide will help you configure multiple Azure accounts for different companies in your Azure Resource Metadata Viewer.

## Overview

The enhanced application now supports:
- **Multiple Azure Tenants** (different companies)
- **Subscription Selection** via dropdown
- **Dynamic Account Loading** 
- **Company Isolation** (resources are separated by tenant)

## Prerequisites

- Azure CLI installed and configured
- Access to multiple Azure subscriptions across different companies
- Admin rights to create app registrations in each tenant

## Step 1: Azure CLI Configuration

### 1.1 Check Current Configuration
```bash
# List current accounts
az account list --output table

# List current tenants
az account tenant list --output table
```

### 1.2 Add Additional Azure Accounts

For each company you want to work with, you'll need to add their Azure account:

```bash
# Company A
az login --tenant <company-a-tenant-id>

# Company B  
az login --tenant <company-b-tenant-id>

# Company C
az login --tenant <company-c-tenant-id>
```

### 1.3 Verify Multiple Accounts
```bash
# List all accounts across tenants
az account list --output table

# You should see subscriptions from different tenants
```

## Step 2: App Registration Setup

### 2.1 Create App Registration in Each Tenant

For each company's tenant, you need to create an app registration:

1. **Go to Azure Portal** → **Azure Active Directory** → **App registrations**
2. **Click "New registration"**
3. **Configure the app:**
   - Name: `Azure Resource Viewer - [Company Name]`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: `https://localhost:5173/` (for development)

### 2.2 Configure API Permissions

For each app registration, add these permissions:

**Microsoft Graph (Delegated):**
- `User.Read`
- `Directory.Read.All` (requires admin consent)

**Azure Service Management (Delegated):**
- `user_impersonation`

### 2.3 Grant Admin Consent

1. Click on **API permissions**
2. Click **Grant admin consent for [Company Name]**
3. Confirm the permissions

### 2.4 Record Credentials

For each company, record:
- **Application (client) ID**
- **Directory (tenant) ID**

## Step 3: Environment Configuration

### 3.1 Create Environment Files

Create separate `.env` files for each company:

**`.env.company-a`**
```env
VITE_AZURE_TENANT_ID=company-a-tenant-id
VITE_AZURE_CLIENT_ID=company-a-client-id
VITE_COMPANY_NAME="Company A"
```

**`.env.company-b`**
```env
VITE_AZURE_TENANT_ID=company-b-tenant-id
VITE_AZURE_CLIENT_ID=company-b-client-id
VITE_COMPANY_NAME="Company B"
```

### 3.2 Switch Between Companies

To work with different companies:

```bash
# Switch to Company A
cp .env.company-a .env
npm run dev

# Switch to Company B  
cp .env.company-b .env
npm run dev
```

## Step 4: Using the Application

### 4.1 Authentication Flow

1. **Sign In**: Click "Sign In" → Choose popup or redirect
2. **Select Tenant**: Choose the company/tenant from dropdown
3. **Select Subscription**: Choose specific subscription within that tenant
4. **Query Resources**: Click "Query Resources" to fetch Azure resources

### 4.2 Features

- **Tenant Selection**: Dropdown shows all available tenants
- **Subscription Filtering**: Only shows subscriptions for selected tenant
- **Resource Isolation**: Resources are completely separated by tenant
- **Account Refresh**: "Refresh" button reloads available accounts

## Step 5: Advanced Configuration

### 5.1 Custom Tenant Names

You can customize tenant display names by modifying the `getTenants` method in `src/api/azureAccounts.ts`:

```typescript
// Add custom mapping for better display names
const tenantNameMapping: Record<string, string> = {
  'tenant-id-1': 'Acme Corporation',
  'tenant-id-2': 'Global Industries',
  'tenant-id-3': 'Tech Solutions Inc.'
};
```

### 5.2 Subscription Grouping

Group subscriptions by purpose or environment:

```typescript
// Add subscription categories
const subscriptionCategories = {
  'prod': 'Production',
  'dev': 'Development', 
  'test': 'Testing',
  'shared': 'Shared Services'
};
```

## Step 6: Troubleshooting

### 6.1 Common Issues

**"Failed to load Azure accounts"**
- Check if user has access to tenant
- Verify app registration permissions
- Ensure admin consent was granted

**"No subscriptions found"**
- User may not have access to subscriptions
- Check subscription state (Enabled/Disabled)
- Verify role assignments

**"Authentication failed"**
- Check tenant ID and client ID
- Verify redirect URI configuration
- Clear browser cache and cookies

### 6.2 Debug Information

Enable debug logging in browser console:

```typescript
// Add to msalConfig.ts
system: {
  loggerOptions: {
    loggerCallback: (level: any, message: string, containsPii: boolean) => {
      if (containsPii) {
        return;
      }
      console.log(message);
    },
    logLevel: LogLevel.Verbose
  }
}
```

## Step 7: Security Considerations

### 7.1 Access Control

- **Least Privilege**: Grant minimal required permissions
- **Regular Review**: Periodically review app permissions
- **Audit Logging**: Monitor sign-in and API usage

### 7.2 Data Isolation

- Resources are completely separated by tenant
- No cross-tenant data access
- Each company's data remains isolated

## Step 8: Deployment

### 8.1 Production Environment

For production deployment:

1. **Update redirect URIs** to production domain
2. **Configure CORS** if needed
3. **Set up monitoring** and logging
4. **Implement backup** and recovery procedures

### 8.2 Environment Variables

Ensure production environment variables are properly configured:

```bash
# Production .env
VITE_AZURE_TENANT_ID=production-tenant-id
VITE_AZURE_CLIENT_ID=production-client-id
VITE_COMPANY_NAME="Production Company"
```

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify Azure CLI configuration
3. Confirm app registration settings
4. Check user permissions in Azure AD

## Next Steps

Once configured, you can:

1. **Query resources** across multiple companies
2. **Compare resource usage** between tenants
3. **Manage access** for different teams
4. **Generate reports** per company
5. **Implement automation** for resource management

---

**Note**: This setup provides complete isolation between companies while allowing you to manage multiple Azure environments from a single application interface.
