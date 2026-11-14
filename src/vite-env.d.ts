/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Identifiants OAuth Google Drive fournis au build (facultatifs, aucune valeur par défaut). */
  readonly VITE_GDRIVE_CLIENT_ID?: string;
  readonly VITE_GDRIVE_CLIENT_SECRET?: string;
}
