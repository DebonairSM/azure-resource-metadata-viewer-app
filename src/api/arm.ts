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


