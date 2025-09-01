import axios from 'axios'

export interface DirectoryObjectMinimal {
	id: string
	'@odata.type'?: string
	displayName?: string
}

export async function getPrincipalsByIds(accessToken: string, ids: string[]): Promise<Record<string, DirectoryObjectMinimal>> {
	if (ids.length === 0) return {}
	const uniqueIds = Array.from(new Set(ids))
	try {
		const url = 'https://graph.microsoft.com/v1.0/directoryObjects/getByIds';
		console.log(`Making Graph API request to: ${url}`);
		
		const { data } = await axios.post<{ value: DirectoryObjectMinimal[] }>(
			url,
			{
				ids: uniqueIds,
				types: ['user', 'group', 'servicePrincipal'],
			},
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		)
		const map: Record<string, DirectoryObjectMinimal> = {}
		for (const obj of data.value || []) {
			map[obj.id] = obj
		}
		return map
	} catch (err: any) {
		console.error('Graph API error:', {
			status: err.response?.status,
			statusText: err.response?.statusText,
			data: err.response?.data,
			message: err.message
		});
		// If Graph permissions are insufficient (403), fall back to empty mapping
		return {}
	}
}


