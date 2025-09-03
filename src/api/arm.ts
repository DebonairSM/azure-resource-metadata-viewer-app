import axios from 'axios'

export interface ArmResourceItem {
	id: string
	name: string
	type: string
	location?: string
	resourceGroup?: string
	tags?: Record<string, string>
	properties?: Record<string, unknown>
}

interface ArmListResponse<T> {
	value: T[]
	nextLink?: string
}

const ARM_API_VERSION_RESOURCES = '2021-04-01'
const ARM_API_VERSION_ROLE_ASSIGNMENTS = '2022-04-01'
const OWNER_ROLE_DEFINITION_GUID = '8e3af657-a8ff-443c-a75c-2fe8c4bcb635'

export async function fetchAllResources(subscriptionId: string, accessToken: string): Promise<ArmResourceItem[]> {
	const baseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resources?api-version=${ARM_API_VERSION_RESOURCES}`
	return await fetchAllPages<ArmResourceItem>(baseUrl, accessToken)
}

export interface RoleAssignment {
	id: string
	name: string
	properties: {
		principalId: string
		principalType?: 'User' | 'Group' | 'ServicePrincipal' | 'ForeignGroup' | 'Device' | string
		roleDefinitionId: string
		scope: string
	}
}

export async function fetchAllOwnerRoleAssignments(subscriptionId: string, accessToken: string): Promise<RoleAssignment[]> {
	// Use atScope() filter to get all role assignments at the subscription scope
	// Then filter for Owner role assignments in the code
	const filter = encodeURIComponent('atScope()')
	const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleAssignments?api-version=${ARM_API_VERSION_ROLE_ASSIGNMENTS}&$filter=${filter}`
	const allAssignments = await fetchAllPages<RoleAssignment>(url, accessToken)
	
	// Filter for Owner role assignments
	const ownerRoleDefinitionId = `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${OWNER_ROLE_DEFINITION_GUID}`
	return allAssignments.filter(assignment => 
		assignment.properties.roleDefinitionId === ownerRoleDefinitionId
	)
}

async function fetchAllPages<T>(url: string, accessToken: string): Promise<T[]> {
	const items: T[] = []
	let next: string | undefined = url
	while (next) {
		try {
			console.log(`Making API request to: ${next}`)
			const response = await axios.get<ArmListResponse<T>>(next, {
				headers: { Authorization: `Bearer ${accessToken}` },
			})
			const data: ArmListResponse<T> = response.data
			if (Array.isArray(data.value)) items.push(...data.value)
			next = data.nextLink
		} catch (error: any) {
			console.error(`API request failed for URL: ${next}`)
			console.error('Error details:', {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
				message: error.message
			})
			throw new Error(`API request failed: ${error.response?.status} ${error.response?.statusText} - ${error.response?.data?.error?.message || error.message}`)
		}
	}
	return items
}

export function parseResourceGroupFromId(resourceId: string): string | undefined {
	const match = /\/resourceGroups\/([^\/]+)\//i.exec(resourceId)
	return match?.[1]
}

/**
 * Get the appropriate API version for a resource type
 * @param resourceId The full resource ID
 * @returns The API version to use for this resource type
 */
function getApiVersionForResource(resourceId: string): string {
	// Extract resource type from resource ID
	// Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{type}/{name}
	const match = resourceId.match(/\/providers\/([^\/]+)\/([^\/]+)/);
	if (!match) {
		return '2021-04-01'; // Default fallback
	}
	
	const provider = match[1];
	const resourceType = match[2];
	
	// API version mappings for common resource types
	const apiVersions: Record<string, string> = {
		// Microsoft.Sql/servers - SQL Server (using stable version from error message)
		'Microsoft.Sql/servers': '2021-11-01',
		'Microsoft.Sql/databases': '2021-11-01',
		'Microsoft.Sql/servers/databases': '2021-11-01',
		
		// Microsoft.Storage/storageAccounts
		'Microsoft.Storage/storageAccounts': '2021-09-01',
		
		// Microsoft.Compute/virtualMachines
		'Microsoft.Compute/virtualMachines': '2021-11-01',
		'Microsoft.Compute/disks': '2021-12-01',
		'Microsoft.Compute/images': '2021-12-01',
		
		// Microsoft.Network resources
		'Microsoft.Network/virtualNetworks': '2021-05-01',
		'Microsoft.Network/networkInterfaces': '2021-05-01',
		'Microsoft.Network/publicIPAddresses': '2021-05-01',
		'Microsoft.Network/loadBalancers': '2021-05-01',
		'Microsoft.Network/networkSecurityGroups': '2021-05-01',
		
		// Microsoft.Web resources
		'Microsoft.Web/sites': '2021-03-01',
		'Microsoft.Web/serverfarms': '2021-03-01',
		
		// Microsoft.KeyVault
		'Microsoft.KeyVault/vaults': '2021-10-01',
		
		// Microsoft.Resources
		'Microsoft.Resources/resourceGroups': '2021-04-01',
		'Microsoft.Resources/deployments': '2021-04-01',
		
		// Microsoft.ContainerService
		'Microsoft.ContainerService/managedClusters': '2021-11-01',
		
		// Microsoft.DBforPostgreSQL
		'Microsoft.DBforPostgreSQL/servers': '2021-06-01',
		'Microsoft.DBforPostgreSQL/flexibleServers': '2021-06-01',
		
		// Microsoft.DBforMySQL
		'Microsoft.DBforMySQL/servers': '2021-05-01',
		'Microsoft.DBforMySQL/flexibleServers': '2021-05-01',
		
		// Microsoft.CognitiveServices
		'Microsoft.CognitiveServices/accounts': '2021-10-01',
		
		// Microsoft.Insights
		'Microsoft.Insights/components': '2020-02-02',
		'Microsoft.Insights/actionGroups': '2021-09-01',
		
		// Microsoft.OperationalInsights
		'Microsoft.OperationalInsights/workspaces': '2021-12-01',
	};
	
	const fullResourceType = `${provider}/${resourceType}`;
	return apiVersions[fullResourceType] || '2021-04-01'; // Default fallback
}

/**
 * Delete an Azure resource by its resource ID with fallback API versions
 * @param resourceId The full resource ID (e.g., /subscriptions/{subscriptionId}/resourceGroups/{rg}/providers/{provider}/{type}/{name})
 * @param accessToken Azure access token with appropriate permissions
 * @returns Promise that resolves when deletion is complete
 * 
 * Azure HTTP Status Codes for Deletion:
 * - 200 OK: Resource deleted immediately
 * - 202 Accepted: Deletion request accepted, processing asynchronously
 * - 204 No Content: Resource deleted successfully
 * - 403 Forbidden: Insufficient permissions
 * - 404 Not Found: Resource not found or already deleted
 * - 409 Conflict: Resource is locked or has dependencies
 */
export async function deleteResource(resourceId: string, accessToken: string): Promise<void> {
	// Get the primary API version for this resource type
	const primaryApiVersion = getApiVersionForResource(resourceId);
	
	// Fallback API versions to try if the primary fails
	const fallbackApiVersions = [
		primaryApiVersion,
		'2021-04-01', // General fallback
		'2020-06-01', // Older stable version
		'2019-10-01', // Even older stable version
	];
	
	// Remove duplicates while preserving order
	const uniqueApiVersions = [...new Set(fallbackApiVersions)];
	
	let lastError: any = null;
	
	for (const apiVersion of uniqueApiVersions) {
		const url = `https://management.azure.com${resourceId}?api-version=${apiVersion}`;
		
		try {
			console.log(`Attempting to delete resource: ${resourceId} with API version: ${apiVersion}`);
			const response = await axios.delete(url, {
				headers: { 
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
			});
			
			// Azure returns 200, 202, or 204 for successful deletion
			// 200 = OK (immediate deletion)
			// 202 = Accepted (asynchronous deletion in progress)
			// 204 = No Content (deletion completed)
			if (response.status === 200 || response.status === 202 || response.status === 204) {
				if (response.status === 202) {
					console.log(`Deletion request accepted for resource: ${resourceId} using API version: ${apiVersion} (asynchronous operation)`);
				} else {
					console.log(`Successfully deleted resource: ${resourceId} using API version: ${apiVersion}`);
				}
				return; // Success! Exit the function
			} else {
				throw new Error(`Unexpected response status: ${response.status}`);
			}
		} catch (error: any) {
			console.error(`Failed to delete resource with API version ${apiVersion}:`, {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
				message: error.message
			});
			
			lastError = error;
			
			// If it's an API version issue, try the next version
			if (error.response?.status === 400) {
				const errorMessage = error.response?.data?.error?.message || error.message;
				if (errorMessage.includes('No registered resource provider found') || 
					errorMessage.includes('API version') ||
					errorMessage.includes('not supported')) {
					console.log(`API version ${apiVersion} not supported, trying next version...`);
					continue; // Try next API version
				}
			}
			
			// For other errors (403, 409, 404), don't retry with different API versions
			break;
		}
	}
	
	// If we get here, all API versions failed
	console.error(`All API versions failed for resource: ${resourceId}`);
	
	// Provide helpful error messages based on the last error
	if (lastError?.response?.status === 403) {
		throw new Error(`Permission denied: You don't have permission to delete this resource. Required roles: Owner or Contributor.`);
	} else if (lastError?.response?.status === 409) {
		throw new Error(`Resource is locked: This resource cannot be deleted because it has a "CanNotDelete" lock. Remove the lock first.`);
	} else if (lastError?.response?.status === 404) {
		throw new Error(`Resource not found: The resource may have already been deleted or you don't have access to it.`);
	} else if (lastError?.response?.status === 400) {
		const errorMessage = lastError.response?.data?.error?.message || lastError.message;
		throw new Error(`API version issue: ${errorMessage}\n\nTried multiple API versions but none were supported for this resource type.`);
	} else {
		const errorMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Unknown error';
		throw new Error(`Failed to delete resource: ${errorMessage}`);
	}
}


