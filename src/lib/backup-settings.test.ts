import { describe, expect, it } from 'bun:test';
import { isImportableSettingKey, isSecretSettingKey, splitImportSettings, withoutSecretSettings } from './backup-settings';

describe('réglages des sauvegardes', () => {
  it('reconnaît les secrets de Phénix CV et ceux d\'autres applications', () => {
    for (const key of ['gdrive_tokens', 'gdrive_tokens_abc123', 'gdrive_custom_client_id', 'gdrive_custom_client_secret',
      'emailSmtpPassword', 'ftClientSecret', 'ftAccessToken', 'navitiaApiKey', 'openai_api_key', 'oauth_state']) {
      expect(isSecretSettingKey(key)).toBe(true);
    }
    for (const key of ['cv_target_pages', 'ai_differentiator', 'cv_personal_rules:abc', 'wizard_state', 'theme']) {
      expect(isSecretSettingKey(key)).toBe(false);
    }
  });

  it('liste blanche à l\'import : réglages utiles au CV seulement', () => {
    for (const key of ['cv_target_pages', 'ai_differentiator', 'cv_personal_rules:p1', 'cv_bullet_focus:p1', 'cv_verb_tense:p1', 'cv_target_sheets:p1']) {
      expect(isImportableSettingKey(key)).toBe(true);
    }
    for (const key of ['theme', 'default_template', 'app_version', 'wizard_state', 'pdf_export_method', 'gdrive_tokens_p1', 'cv_personal_rules', 'inconnu']) {
      expect(isImportableSettingKey(key)).toBe(false);
    }
  });

  it('tri à l\'import : secrets comptés sans être nommés, autres réglages listés', () => {
    const split = splitImportSettings([
      { key: 'cv_target_pages', value: '1' }, { key: 'gdrive_tokens_x', value: 'FAUX' }, { key: 'theme', value: 'dark' }, { value: 'sans clé' },
    ]);
    expect(split.kept).toEqual([{ key: 'cv_target_pages', value: '1' }]);
    expect(split.secretCount).toBe(1);
    expect(split.ignoredKeys).toEqual(['theme', '']);
  });

  it('export : secrets retirés', () => {
    expect(withoutSecretSettings([{ key: 'theme', value: 'light' }, { key: 'gdrive_tokens', value: 'FAUX' }])).toEqual([{ key: 'theme', value: 'light' }]);
  });
});
