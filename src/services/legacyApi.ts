// Accès à l'API REST « legacy » de GLPI (`/api.php/v1`, via le proxy `/api/v1`).
// Utilisée UNIQUEMENT pour l'upload de fichiers (documents), que l'API OAuth
// High-Level n'expose pas. Authentification par jeton API personnel (user_token)
// configuré dans `.env` — l'API legacy n'accepte pas le Bearer OAuth.

import { config } from '../config'

const BASE = `${config.apiBaseUrl}/v1`

/**
 * Condense un corps d'erreur legacy en message court. GLPI renvoie parfois une
 * page HTML complète (erreur 500) : inutile de la déverser dans le rapport.
 */
function detailErreur(corps: string): string {
  const t = corps.trim()
  if (t === '') return ''
  if (/^\s*<(!doctype|html)/i.test(t)) return 'erreur interne GLPI (HTML)'
  return t.slice(0, 200)
}

let sessionToken: string | null = null

/** True si un jeton est configuré (sinon l'upload d'images est désactivé). */
export function uploadDisponible(): boolean {
  return config.glpiUserToken.trim() !== ''
}

function entetes(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra }
  if (config.glpiAppToken) h['App-Token'] = config.glpiAppToken
  return h
}

/** Ouvre une session legacy à partir du user_token. Idempotent. */
export async function ouvrirSession(): Promise<void> {
  if (sessionToken) return
  if (!uploadDisponible()) throw new Error('VITE_GLPI_USER_TOKEN non configuré')

  const res = await fetch(`${BASE}/initSession`, {
    headers: entetes({ Authorization: `user_token ${config.glpiUserToken}` }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`initSession → ${res.status}${detail ? ` (${detail.slice(0, 200)})` : ''}`)
  }
  const data = (await res.json()) as { session_token?: string }
  if (!data.session_token) throw new Error('initSession : session_token absent')
  sessionToken = data.session_token
}

/** Ferme la session legacy (best-effort). */
export async function fermerSession(): Promise<void> {
  if (!sessionToken) return
  try {
    await fetch(`${BASE}/killSession`, {
      headers: entetes({ 'Session-Token': sessionToken }),
    })
  } catch {
    /* best-effort */
  }
  sessionToken = null
}

/**
 * Upload un fichier en tant que Document GLPI, lié automatiquement à un item
 * (itemtype + items_id → Document_Item créé par GLPI). Renvoie l'id du document.
 */
export async function uploaderDocument(opts: {
  blob: Blob
  filename: string
  name: string
  itemtype: string
  items_id: number
}): Promise<number> {
  if (!sessionToken) throw new Error('session legacy non initialisée')

  const manifest = {
    input: {
      name: opts.name,
      itemtype: opts.itemtype,
      items_id: opts.items_id,
    },
  }
  const form = new FormData()
  form.append('uploadManifest', JSON.stringify(manifest))
  form.append('filename[0]', opts.blob, opts.filename)

  // NB : pas de Content-Type manuel → le navigateur fixe la boundary multipart.
  const res = await fetch(`${BASE}/Document`, {
    method: 'POST',
    headers: entetes({ 'Session-Token': sessionToken }),
    body: form,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`POST Document → ${res.status}${detail ? ` (${detail.slice(0, 200)})` : ''}`)
  }
  const data: unknown = await res.json()
  const id = Array.isArray(data)
    ? (data[0] as Record<string, unknown>)?.id
    : (data as Record<string, unknown>)?.id
  if (typeof id !== 'number') throw new Error('POST Document : id absent de la réponse')
  return id
}

/**
 * Associe un élément GLPI à un ticket via l'API legacy v1.
 * Nécessite VITE_GLPI_USER_TOKEN. Un 409 (déjà associé) est traité comme succès.
 */
export async function associerElementTicket(
  ticketId: number,
  itemtype: string,
  itemsId: number,
): Promise<void> {
  if (!sessionToken) throw new Error('session legacy non initialisée')

  const res = await fetch(`${BASE}/Item_Ticket/`, {
    method: 'POST',
    headers: entetes({
      'Session-Token': sessionToken,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      input: { tickets_id: ticketId, itemtype, items_id: itemsId },
    }),
  })

  if (res.ok || res.status === 409) return
  const detail = await res.text().catch(() => '')
  throw new Error(`Item_Ticket → ${res.status}${detail ? ` (${detail.slice(0, 200)})` : ''}`)
}

/** Supprime définitivement un document (rollback). Best-effort. */
export async function supprimerDocument(id: number): Promise<void> {
  if (!sessionToken) return
  try {
    await fetch(`${BASE}/Document/${id}?force_purge=true`, {
      method: 'DELETE',
      headers: entetes({ 'Session-Token': sessionToken }),
    })
  } catch {
    /* best-effort */
  }
}

/**
 * Crée un lien matériel ↔ ticket (relation Item_Ticket : onglet « Éléments »
 * d'un ticket). L'API OAuth High-Level n'expose pas de route de création pour
 * ce type ; seule l'API legacy le permet. Renvoie l'id du lien créé.
 */
export async function lierItemTicket(opts: {
  itemtype: string
  items_id: number
  tickets_id: number
}): Promise<number> {
  if (!sessionToken) throw new Error('session legacy non initialisée')

  const res = await fetch(`${BASE}/Item_Ticket`, {
    method: 'POST',
    headers: entetes({ 'Session-Token': sessionToken, 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      input: {
        itemtype: opts.itemtype,
        items_id: opts.items_id,
        tickets_id: opts.tickets_id,
      },
    }),
  })
  if (!res.ok) {
    const detail = detailErreur(await res.text().catch(() => ''))
    throw new Error(`POST Item_Ticket → ${res.status}${detail ? ` (${detail})` : ''}`)
  }
  const data: unknown = await res.json()
  const id = Array.isArray(data)
    ? (data[0] as Record<string, unknown>)?.id
    : (data as Record<string, unknown>)?.id
  if (typeof id !== 'number') throw new Error('POST Item_Ticket : id absent de la réponse')
  return id
}

/**
 * Compte les éléments d'un itemtype via l'API legacy, pour les types que l'API
 * High-Level n'expose pas (CartridgeItem, ConsumableItem). Le total est lu dans
 * l'en-tête Content-Range (« 0-0/N ») d'une requête à plage vide (`range=0-0`).
 * Nécessite VITE_GLPI_USER_TOKEN. Renvoie 0 si le type est vide/indisponible.
 */
export async function compterItemLegacy(itemtype: string): Promise<number> {
  await ouvrirSession()

  const res = await fetch(`${BASE}/${itemtype}?range=0-0&only_id=true`, {
    headers: entetes({ 'Session-Token': sessionToken! }),
  })
  // Liste vide → GLPI renvoie 400 (ERROR_RANGE_EXCEED_TOTAL) sans Content-Range.
  if (res.status === 400) return 0
  if (!res.ok && res.status !== 206) {
    const detail = detailErreur(await res.text().catch(() => ''))
    throw new Error(`GET ${itemtype} (count) → ${res.status}${detail ? ` (${detail})` : ''}`)
  }
  const range = res.headers.get('Content-Range')
  if (!range) return 0
  const total = Number(range.slice(range.lastIndexOf('/') + 1))
  return Number.isFinite(total) ? total : 0
}

/**
 * Une ligne brute de la table `glpi_logs`, telle que renvoyée par l'API legacy
 * dans le champ `_logs` quand on passe `with_logs=true`.
 */
export interface LegacyLog {
  id: number
  itemtype: string
  items_id: number
  itemtype_link: string
  /** 0 = modification d'un champ ; >0 = action interne (voir constantes Log::HISTORY_*). */
  linked_action: number
  /** Auteur, préformaté par GLPI (ex. « glpi glpi (2) »). */
  user_name: string
  date_mod: string
  /** ID de la search option du champ modifié (ex. 12 = statut d'un ticket). */
  id_search_option: number
  old_value: string
  new_value: string
}

/**
 * Récupère l'historique (table `glpi_logs`) d'un item via l'API legacy
 * (`GET /{itemtype}/{id}?with_logs=true`). L'API OAuth High-Level n'expose pas
 * les logs ; seule l'API legacy le permet, ce qui nécessite VITE_GLPI_USER_TOKEN.
 * Renvoie un tableau vide si l'item n'a pas de logs.
 */
export async function getItemLogs(itemtype: string, itemsId: number): Promise<LegacyLog[]> {
  await ouvrirSession()

  const res = await fetch(`${BASE}/${itemtype}/${itemsId}?with_logs=true&expand_dropdowns=false`, {
    headers: entetes({ 'Session-Token': sessionToken! }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`GET ${itemtype}/${itemsId} logs → ${res.status}${detail ? ` (${detail.slice(0, 200)})` : ''}`)
  }

  const data = (await res.json()) as Record<string, unknown>
  const logs = data._logs
  // `_logs` provient d'un tableau associatif PHP (getAllDataFromTable) : il est
  // sérialisé en OBJET indexé par id ({"951": {...}}), pas en tableau JSON.
  if (Array.isArray(logs)) return logs as LegacyLog[]
  if (logs && typeof logs === 'object') return Object.values(logs) as LegacyLog[]
  return []
}

/**
 * Crée un élément via l'API legacy (`POST /{itemtype}`) pour les types que
 * l'API High-Level n'expose pas (CartridgeItem, ConsumableItem). Le corps suit
 * la convention legacy : champs `*_id` (locations_id, manufacturers_id…).
 * Renvoie l'id créé.
 */
export async function creerItemLegacy(
  itemtype: string,
  input: Record<string, unknown>,
): Promise<number> {
  if (!sessionToken) throw new Error('session legacy non initialisée')

  const res = await fetch(`${BASE}/${itemtype}`, {
    method: 'POST',
    headers: entetes({ 'Session-Token': sessionToken, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ input }),
  })
  if (!res.ok) {
    const detail = detailErreur(await res.text().catch(() => ''))
    throw new Error(`POST ${itemtype} → ${res.status}${detail ? ` (${detail})` : ''}`)
  }
  const data: unknown = await res.json()
  const id = Array.isArray(data)
    ? (data[0] as Record<string, unknown>)?.id
    : (data as Record<string, unknown>)?.id
  if (typeof id !== 'number') throw new Error(`POST ${itemtype} : id absent de la réponse`)
  return id
}

/** Supprime définitivement un élément créé via legacy (rollback). Best-effort. */
export async function supprimerItemLegacy(itemtype: string, id: number): Promise<void> {
  if (!sessionToken) return
  try {
    await fetch(`${BASE}/${itemtype}/${id}?force_purge=true`, {
      method: 'DELETE',
      headers: entetes({ 'Session-Token': sessionToken }),
    })
  } catch {
    /* best-effort */
  }
}

/** Supprime un lien matériel ↔ ticket (rollback). Best-effort. */
export async function supprimerItemTicket(id: number): Promise<void> {
  if (!sessionToken) return
  try {
    await fetch(`${BASE}/Item_Ticket/${id}?force_purge=true`, {
      method: 'DELETE',
      headers: entetes({ 'Session-Token': sessionToken }),
    })
  } catch {
    /* best-effort */
  }
}
