import { fetchList, fetchAllIds, supprimerItem } from './glpiApi'
import type { ListResult } from './glpiApi'

const ENDPOINT = '/Administration/User'

export async function listerUtilisateurs(start = 0, limit = 20): Promise<ListResult> {
  return fetchList(ENDPOINT, { start, limit })
}

export async function tousLesIdsUtilisateurs(): Promise<number[]> {
  return fetchAllIds(ENDPOINT)
}

export async function supprimerUtilisateur(id: number): Promise<void> {
  return supprimerItem(ENDPOINT, id)
}
