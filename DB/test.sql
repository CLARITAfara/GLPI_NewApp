CREATE TABLE utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT UNIQUE,
    mot_de_passe TEXT NOT NULL,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    actif INTEGER DEFAULT 1
);

INSERT INTO utilisateurs (
    nom,
    prenom,
    email,
    mot_de_passe
)
VALUES (
    'Rakoto',
    'Jean',
    'jean.rakoto@example.com',
    'motdepasse123'
);

SELECT * FROM utilisateurs;

SELECT * FROM utilisateurs where  id = '1';






