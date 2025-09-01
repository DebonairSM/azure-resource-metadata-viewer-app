# Authentication Setup Guide

## Current Issue

You're encountering authentication issues where the application bypasses the sign-in prompt and uses cached credentials from a previous session. This can happen when:

1. You're already signed into Azure in your browser
2. MSAL is using cached tokens from a previous session
3. The app registration doesn't exist in the tenant you're trying to access

## Solutions

### Option 1: Create Multi-Tenant App Registration (Recommended)

If you have access to create app registrations in your home tenant:

1. **Go to Azure Portal** → **Azure Active Directory** → **App registrations**
2. **Click "New registration"**
3. **Configure:**
   - **Name:** "Azure Resource Viewer - Multi-Tenant"
   - **Supported account types:** "Accounts in any organizational directory (Any Azure AD directory - Multitenant)"
   - **Redirect URI:** `http://localhost:5173/` (for development)
4. **Click "Register"**
5. **Copy the Application (client) ID**
6. **Configure API permissions:**
   - **Microsoft Graph (Delegated):**
     - `User.Read`
     - `Directory.Read.All` (requires admin consent)
   - **Azure Service Management (Delegated):**
     - `user_impersonation`
7. **Grant admin consent** for your tenant
8. **Update your environment variables** with the new client ID

### Option 2: Create App Registration in Specific Tenant

If you need to work with a specific tenant:

1. **Contact the tenant administrator** to create an app registration
2. **Provide them with these requirements:**
   - **Name:** "Azure Resource Viewer"
   - **Redirect URI:** `http://localhost:5173/`
   - **API Permissions:** User.Read, Directory.Read.All, user_impersonation
   - **Admin consent required** for Directory.Read.All
3. **Get the Application (client) ID** from them
4. **Update your environment variables**

### Option 3: Use Existing App Registration in Different Tenant

If you have access to an existing app registration in a different tenant:

1. **Find the tenant** where the app registration exists
2. **Update your environment variables** to use that tenant specifically
3. **Create a `.env` file** with:
   ```env
   VITE_AZURE_CLIENT_ID=your-existing-client-id
   VITE_AZURE_TENANT_ID=specific-tenant-id
   ```

## Environment Configuration

Create a `.env` file in your project root with:

```env
# For multi-tenant app registration
VITE_AZURE_CLIENT_ID=your-new-client-id-here
VITE_AZURE_TENANT_ID=common

# OR for single-tenant app registration
# VITE_AZURE_CLIENT_ID=your-client-id-here
# VITE_AZURE_TENANT_ID=specific-tenant-id-here

VITE_COMPANY_NAME="Azure Resource Viewer"
VITE_APP_ENV=development
```

## Testing the Configuration

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the application** in your browser
3. **If authentication is bypassed or using wrong tenant:**
   - Click "Sign In" → "🔄 Fresh Sign In (Popup)" or "🔄 Fresh Sign In (Redirect)"
   - Or click "Sign Out" → "🗑️ Clear Cache & Reload"
   - Or manually clear browser cache and cookies
4. **Check the browser console** for any error messages

## Force Fresh Authentication

If the application is bypassing the sign-in prompt or using cached credentials from the wrong tenant:

### Option 1: Use Fresh Sign In (Recommended)
- Click the "Sign In" dropdown
- Select "🔄 Fresh Sign In (Popup)" or "🔄 Fresh Sign In (Redirect)"
- This will clear the cache and force account selection

### Option 2: Clear Cache Manually
- Click the "Sign Out" dropdown
- Select "🗑️ Clear Cache & Reload"
- This will clear all MSAL cache and reload the page

### Option 3: Browser-Level Clearing
- Clear browser cache and cookies
- Sign out of all Azure accounts in your browser
- Use incognito/private browsing mode

## Troubleshooting

### Common Issues

1. **"Application not found"**
   - Verify the client ID is correct
   - Ensure the app registration exists in the target tenant
   - Check if the app registration is configured for multi-tenant access

2. **"Insufficient privileges"**
   - Ensure admin consent has been granted
   - Verify the required API permissions are configured

3. **"Redirect URI mismatch"**
   - Ensure the redirect URI in the app registration matches your development URL
   - For development: `http://localhost:5173/`
   - For production: your actual domain

### Debug Information

The application now includes verbose logging. Check the browser console for detailed MSAL logs that will help identify the exact issue.

## Next Steps

Once you have a working app registration:

1. **Test authentication** with different tenants
2. **Verify API permissions** are working
3. **Test resource querying** functionality
4. **Configure for production** deployment

## Support

If you continue to have issues:

1. **Check the browser console** for detailed error messages
2. **Verify your Azure AD permissions** in the target tenant
3. **Contact the tenant administrator** for app registration access
4. **Review the MSAL documentation** for additional configuration options

---

**Note:** If you're experiencing authentication issues, try clearing your browser cache and signing out of all Azure accounts before testing the application.
