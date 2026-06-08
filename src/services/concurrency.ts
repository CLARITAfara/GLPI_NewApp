// Exécution parallèle bornée : N requêtes « en vol » au maximum.
// L'API GLPI High-Level n'expose aucune route batch (un POST/DELETE = un objet) ;
// la parallélisation contrôlée est donc le principal levier de performance.

/**
 * Applique `tache` à chaque élément de `items` avec au plus `limite` exécutions
 * simultanées. Les résultats conservent l'ordre des `items`.
 *
 * L'exécution est interrompue dès qu'une tâche rejette (comportement
 * Promise.all). Les tâches qui doivent être tolérantes aux erreurs doivent donc
 * capturer leurs propres exceptions.
 */
export async function pool<T, R>(
  items: readonly T[],
  limite: number,
  tache: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const resultats = new Array<R>(items.length)
  let curseur = 0

  const worker = async (): Promise<void> => {
    while (curseur < items.length) {
      const i = curseur++
      resultats[i] = await tache(items[i], i)
    }
  }

  const n = Math.max(1, Math.min(limite, items.length))
  await Promise.all(Array.from({ length: n }, worker))
  return resultats
}
