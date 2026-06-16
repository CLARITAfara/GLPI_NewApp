import { fetchList, fetchAllIds, supprimerItem } from './glpiApi'
import type { ListResult } from './glpiApi'

const ENDPOINT = '/Assets/Computer'

export async function listerOrdinateurs(start = 0, limit = 20): Promise<ListResult> {
  return fetchList(ENDPOINT, { start, limit })
}

export async function tousLesIdsOrdinateurs(): Promise<number[]> {
  return fetchAllIds(ENDPOINT)
}

export async function supprimerOrdinateur(id: number): Promise<void> {
  return supprimerItem(ENDPOINT, id)
}
