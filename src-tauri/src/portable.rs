//! Mode portable : Phénix CV tourne sans installation, par exemple depuis une clé USB.
//!
//! Si un fichier `.portable` se trouve à côté de l'exécutable, TOUT ce que l'application écrit va
//! dans le dossier `data` à côté de lui : la base de données, les sauvegardes automatiques, le
//! journal d'export PDF et les données du moteur d'affichage (WebView2). Rien n'est laissé sur
//! l'ordinateur qui prête sa prise USB. Sans ce fichier, l'application se comporte comme une
//! application installée (dossiers de données de Windows).
//!
//! Ce module n'utilise que la bibliothèque standard : il est testable seul.

use std::path::{Path, PathBuf};

/// Fichier (vide) dont la présence à côté de l'exécutable active le mode portable.
pub const MARKER: &str = ".portable";
/// Dossier des données, à côté de l'exécutable.
pub const DATA_DIR: &str = "data";
/// Données du moteur d'affichage (cache, stockage local), dans `data`.
pub const WEBVIEW_DIR: &str = "webview2";
/// Sauvegardes automatiques faites avant une restauration ou un import.
pub const AUTO_BACKUP_DIR: &str = "sauvegardes-automatiques";

/// État du mode portable au lancement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Mode {
    /// Pas de fichier `.portable` : application installée.
    Off,
    /// Mode portable actif : les données sont dans ce dossier.
    Portable(PathBuf),
    /// Fichier `.portable` présent, mais le dossier `data` est inaccessible en écriture (clé protégée
    /// en écriture, dossier système…) : l'application utilise les dossiers de Windows et le dit.
    Unavailable { data_dir: PathBuf, reason: String },
}

impl Mode {
    /// Dossier des données portables, si le mode est actif.
    pub fn data_dir(&self) -> Option<&Path> {
        match self {
            Mode::Portable(dir) => Some(dir),
            _ => None,
        }
    }
}

/// Essaie d'écrire dans le dossier (création, fichier d'essai) : un dossier en lecture seule
/// ne doit pas faire perdre les données plus tard.
fn writable(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let probe = dir.join(".ecriture-possible");
    std::fs::write(&probe, b"ok").map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&probe);
    Ok(())
}

/// Mode portable pour un dossier d'exécutable donné.
pub fn mode_for(exe_dir: &Path) -> Mode {
    if !exe_dir.join(MARKER).exists() {
        return Mode::Off;
    }
    let data_dir = exe_dir.join(DATA_DIR);
    match writable(&data_dir) {
        Ok(()) => Mode::Portable(data_dir),
        Err(reason) => Mode::Unavailable { data_dir, reason },
    }
}

/// Mode portable de l'application en cours d'exécution.
pub fn current_mode() -> Mode {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(mode_for))
        .unwrap_or(Mode::Off)
}

/// Adresse de la base SQLite en mode portable (`sqlite:` suivi d'un chemin absolu).
pub fn db_uri(data_dir: &Path) -> String {
    format!("sqlite:{}", data_dir.join("phenixcv.db").display())
}

/// Dossier des sauvegardes automatiques : dans `data` en mode portable, sinon dans le dossier de
/// données de l'application.
pub fn auto_backup_dir(mode: &Mode, app_data: &Path) -> PathBuf {
    mode.data_dir().unwrap_or(app_data).join(AUTO_BACKUP_DIR)
}

/// Nom de fichier de sauvegarde automatique accepté : lettres, chiffres, `-`, `_`, `.`, terminé par
/// `.cvmaker`, sans chemin (aucun `/`, `\` ni `..`).
pub fn is_valid_backup_name(name: &str) -> bool {
    name.len() <= 120
        && name.ends_with(".cvmaker")
        && !name.starts_with('.')
        && !name.contains("..")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("phenix-portable-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sans_fichier_marqueur_pas_de_mode_portable() {
        let dir = temp("off");
        assert_eq!(mode_for(&dir), Mode::Off);
        assert!(!dir.join(DATA_DIR).exists(), "aucun dossier data ne doit être créé");
    }

    #[test]
    fn avec_fichier_marqueur_le_dossier_data_est_cree() {
        let dir = temp("on");
        std::fs::write(dir.join(MARKER), b"").unwrap();
        let mode = mode_for(&dir);
        assert_eq!(mode, Mode::Portable(dir.join(DATA_DIR)));
        assert!(dir.join(DATA_DIR).is_dir());
        assert!(!dir.join(DATA_DIR).join(".ecriture-possible").exists(), "le fichier d'essai est retiré");
    }

    #[test]
    fn dossier_data_impossible_a_creer_le_mode_est_indisponible() {
        let dir = temp("bloque");
        std::fs::write(dir.join(MARKER), b"").unwrap();
        // Un FICHIER nommé `data` empêche de créer le dossier.
        std::fs::write(dir.join(DATA_DIR), b"pas un dossier").unwrap();
        match mode_for(&dir) {
            Mode::Unavailable { data_dir, reason } => {
                assert_eq!(data_dir, dir.join(DATA_DIR));
                assert!(!reason.is_empty());
            }
            autre => panic!("mode inattendu : {autre:?}"),
        }
        assert_eq!(mode_for(&dir).data_dir(), None);
    }

    #[test]
    fn adresse_de_la_base() {
        let uri = db_uri(Path::new("/cle/Phenix/data"));
        assert!(uri.starts_with("sqlite:"));
        assert!(uri.ends_with("phenixcv.db"));
        assert!(uri.contains("data"));
    }

    #[test]
    fn dossier_des_sauvegardes_automatiques() {
        let app_data = Path::new("/utilisateur/appdata");
        assert_eq!(auto_backup_dir(&Mode::Off, app_data), app_data.join("sauvegardes-automatiques"));
        let portable = Mode::Portable(PathBuf::from("/cle/data"));
        assert_eq!(auto_backup_dir(&portable, app_data), PathBuf::from("/cle/data").join("sauvegardes-automatiques"));
        let indispo = Mode::Unavailable { data_dir: PathBuf::from("/cle/data"), reason: "lecture seule".into() };
        assert_eq!(auto_backup_dir(&indispo, app_data), app_data.join("sauvegardes-automatiques"));
    }

    #[test]
    fn noms_de_sauvegarde_acceptes_et_refuses() {
        assert!(is_valid_backup_name("avant-restauration_2026-11-17_10-42-05.cvmaker"));
        for mauvais in ["", ".cvmaker", "a/b.cvmaker", "a\\b.cvmaker", "../x.cvmaker", "x..y.cvmaker", "x.txt", "é.cvmaker", "x y.cvmaker", ".cache.cvmaker"] {
            assert!(!is_valid_backup_name(mauvais), "{mauvais:?} doit être refusé");
        }
        assert!(!is_valid_backup_name(&format!("{}.cvmaker", "a".repeat(200))));
    }
}
