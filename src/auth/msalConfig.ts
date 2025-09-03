import { PublicClientApplication, type Configuration, LogLevel } from '@azure/msal-browser'

// Get configuration from environment variables
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID as string
// Default to 'common' for multi-tenant support unless specifically configured for single-tenant
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID as string || 'common'

if (!clientId) {
	// Surface early to help configuration
	// eslint-disable-next-line no-console
	console.warn('Missing VITE_AZURE_CLIENT_ID in environment')
	console.warn('Please create a .env file with your Azure AD app registration details')
}

// Determine the authority based on tenant configuration
const getAuthority = () => {
	if (tenantId === 'common') {
		return 'https://login.microsoftonline.com/common'
	} else {
		return `https://login.microsoftonline.com/${tenantId}`
	}
}

// Configuration that supports both single-tenant and multi-tenant scenarios
const msalConfig: Configuration = {
	auth: {
		clientId,
		authority: getAuthority(),
		redirectUri: window.location.origin,
		// Force fresh authentication by not using cached tokens
		postLogoutRedirectUri: window.location.origin,
	},
	cache: {
		cacheLocation: 'localStorage',
		storeAuthStateInCookie: false,
		// Clear cache on startup to force fresh authentication
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
			logLevel: LogLevel.Verbose
		}
	}
}

export const msalInstance = new PublicClientApplication(msalConfig)

// Initialize the MSAL instance
msalInstance.initialize().then(() => {
  console.log('MSAL instance initialized successfully');
}).catch((error) => {
  console.error('Failed to initialize MSAL instance:', error);
});

export const ARM_SCOPE = 'https://management.azure.com/user_impersonation'
export const GRAPH_SCOPES = ['User.Read', 'Directory.Read.All']

// Multi-tenant support
export const getAuthorityForTenant = (tenantId: string) => 
	`https://login.microsoftonline.com/${tenantId}`

export const getMsalInstanceForTenant = async (tenantId: string) => {
	const config: Configuration = {
		...msalConfig,
		auth: {
			...msalConfig.auth,
			authority: getAuthorityForTenant(tenantId),
		}
	}
	const instance = new PublicClientApplication(config)
	await instance.initialize()
	return instance
}

// Function to clear MSAL cache and force fresh authentication
export const clearMsalCache = async () => {
	try {
		// Note: removeAccount method is not available in current MSAL version
		// We'll clear the cache manually via localStorage/sessionStorage
		
		// Clear localStorage cache
		const keys = Object.keys(localStorage)
		keys.forEach(key => {
			if (key.startsWith('msal.')) {
				localStorage.removeItem(key)
			}
		})
		
		// Clear sessionStorage cache
		const sessionKeys = Object.keys(sessionStorage)
		sessionKeys.forEach(key => {
			if (key.startsWith('msal.')) {
				sessionStorage.removeItem(key)
			}
		})
		
		console.log('MSAL cache cleared successfully')
	} catch (error) {
		console.error('Error clearing MSAL cache:', error)
	}
}

// Function to force fresh authentication with prompt
export const forceFreshAuthentication = async () => {
	await clearMsalCache()
	// The next login attempt will now prompt for fresh authentication
}


