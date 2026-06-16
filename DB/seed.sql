-- =====================================================================
--  seed.sql — Données essentielles restaurées après chaque reset
--  Modifiez ce fichier pour définir vos données par défaut
-- =====================================================================

-- Utilisateurs administrateurs (toujours conservés)
INSERT INTO utilisateurs (nom, email, role, actif) VALUES
  ('Administrateur', 'admin@glpi.local', 'admin', 1);
