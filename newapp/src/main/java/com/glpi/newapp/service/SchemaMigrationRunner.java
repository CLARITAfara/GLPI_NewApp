package com.glpi.newapp.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Migration legere du schema SQLite au demarrage : ajoute les colonnes
 * manquantes sur les tables deja existantes. En effet `CREATE TABLE IF NOT
 * EXISTS` (schema.sql) ne met JAMAIS a jour une table creee par une ancienne
 * version : sur un poste avec une base plus ancienne il manque des colonnes
 * (ex. ticket_cost_events.annule), ce qui fait planter le demarrage.
 *
 * Rend `mvn spring-boot:run` autonome sur n'importe quel poste, sans retoucher
 * la base a la main. S'execute AVANT le RebuildFixedCostsRunner (@Order).
 */
@Component
@Order(1)
@RequiredArgsConstructor
public class SchemaMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        // Colonnes attendues sur ticket_cost_events (nom -> definition DDL).
        // L'ordre suit l'entite ; SQLite exige un DEFAULT pour un ADD COLUMN NOT NULL.
        Map<String, String> colonnes = new LinkedHashMap<>();
        colonnes.put("type", "TEXT NOT NULL DEFAULT 'COST'");
        colonnes.put("montant", "REAL NOT NULL DEFAULT 0");
        colonnes.put("pourcentage", "REAL NOT NULL DEFAULT 0");
        colonnes.put("mode_calcul", "INTEGER NOT NULL DEFAULT 1");
        colonnes.put("ordre", "INTEGER NOT NULL DEFAULT 0");
        colonnes.put("annule", "INTEGER NOT NULL DEFAULT 0");
        colonnes.put("created_at", "DATETIME");
        ajouterColonnesManquantes("ticket_cost_events", colonnes);
    }

    /** Ajoute par ALTER TABLE les colonnes absentes de la table (idempotent). */
    private void ajouterColonnesManquantes(String table, Map<String, String> colonnes) {
        List<Map<String, Object>> infos = jdbc.queryForList("PRAGMA table_info(" + table + ")");
        if (infos.isEmpty()) {
            return; // table absente : schema.sql la cree entierement, rien a migrer
        }
        Set<String> existantes = new HashSet<>();
        for (Map<String, Object> ligne : infos) {
            Object nom = ligne.get("name");
            if (nom != null) {
                existantes.add(nom.toString());
            }
        }
        colonnes.forEach((nom, ddl) -> {
            if (!existantes.contains(nom)) {
                jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + nom + " " + ddl);
            }
        });
    }
}
