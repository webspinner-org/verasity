import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('configuration storage', () => {
  let a, dom;

  beforeEach(() => {
    dom = loadApp();
    a = api(dom);
  });

  function set(id, value) {
    dom.window.document.getElementById(id).value = value;
  }

  function get(id) {
    return dom.window.document.getElementById(id).value;
  }

  describe('default values', () => {
    it('seeds default Anthropic model', () => {
      expect(get('anthropic-model')).toBe('claude-opus-4-7');
    });

    it('seeds default OpenAI model', () => {
      expect(get('openai-model')).toBe('gpt-5');
    });

    it('seeds default Google model', () => {
      expect(get('google-model')).toBe('gemini-2.5-flash');
    });

    it('starts with empty key fields', () => {
      expect(get('anthropic-key')).toBe('');
      expect(get('openai-key')).toBe('');
      expect(get('google-key')).toBe('');
    });
  });

  describe('saveConfig', () => {
    it('persists keys to localStorage', () => {
      set('anthropic-key', 'sk-ant-test');
      set('openai-key', 'sk-test');
      set('google-key', 'AIza-test');
      a.saveConfig();

      const raw = dom.window.localStorage.getItem(a.STORAGE_KEY);
      expect(raw).not.toBeNull();
      const cfg = JSON.parse(raw);
      expect(cfg.anthropicKey).toBe('sk-ant-test');
      expect(cfg.openaiKey).toBe('sk-test');
      expect(cfg.googleKey).toBe('AIza-test');
    });

    it('trims whitespace from saved values', () => {
      set('anthropic-key', '  sk-ant  ');
      a.saveConfig();
      const cfg = JSON.parse(dom.window.localStorage.getItem(a.STORAGE_KEY));
      expect(cfg.anthropicKey).toBe('sk-ant');
    });

    it('persists model overrides', () => {
      set('anthropic-model', 'claude-opus-5');
      a.saveConfig();
      const cfg = JSON.parse(dom.window.localStorage.getItem(a.STORAGE_KEY));
      expect(cfg.anthropicModel).toBe('claude-opus-5');
    });
  });

  describe('loadConfig', () => {
    it('restores values from current storage key', () => {
      dom.window.localStorage.setItem(a.STORAGE_KEY, JSON.stringify({
        anthropicKey: 'sk-stored',
        openaiModel:  'gpt-custom'
      }));
      a.loadConfig();
      expect(get('anthropic-key')).toBe('sk-stored');
      expect(get('openai-model')).toBe('gpt-custom');
    });

    it('falls back to legacy v4 key when v4.1 is absent', () => {
      dom.window.localStorage.setItem('triangulation_v4_config', JSON.stringify({
        anthropicKey: 'sk-legacy-v4'
      }));
      a.loadConfig();
      expect(get('anthropic-key')).toBe('sk-legacy-v4');
    });

    it('falls back to legacy v3.1 key when neither newer key exists', () => {
      dom.window.localStorage.setItem('triangulation_v3_1_config', JSON.stringify({
        googleKey: 'AIza-legacy'
      }));
      a.loadConfig();
      expect(get('google-key')).toBe('AIza-legacy');
    });

    it('does not throw on malformed JSON', () => {
      dom.window.localStorage.setItem(a.STORAGE_KEY, '{not valid json');
      expect(() => a.loadConfig()).not.toThrow();
    });

    it('prefers current storage key over legacy', () => {
      dom.window.localStorage.setItem(a.STORAGE_KEY, JSON.stringify({ anthropicKey: 'new' }));
      dom.window.localStorage.setItem('triangulation_v4_config', JSON.stringify({ anthropicKey: 'old' }));
      a.loadConfig();
      expect(get('anthropic-key')).toBe('new');
    });
  });

  describe('clearKeys', () => {
    it('removes the storage entry', () => {
      dom.window.localStorage.setItem(a.STORAGE_KEY, JSON.stringify({ anthropicKey: 'x' }));
      a.clearKeys();
      expect(dom.window.localStorage.getItem(a.STORAGE_KEY)).toBeNull();
    });

    it('resets model fields to defaults', () => {
      set('anthropic-model', 'custom');
      set('openai-model', 'custom2');
      set('google-model', 'custom3');
      a.clearKeys();
      expect(get('anthropic-model')).toBe('claude-opus-4-7');
      expect(get('openai-model')).toBe('gpt-5');
      expect(get('google-model')).toBe('gemini-2.5-flash');
    });

    it('clears key fields', () => {
      set('anthropic-key', 'k1');
      set('openai-key', 'k2');
      a.clearKeys();
      expect(get('anthropic-key')).toBe('');
      expect(get('openai-key')).toBe('');
    });

    it('does not clear when confirm is denied', () => {
      const dom2 = loadApp({ confirm: false });
      const a2 = api(dom2);
      dom2.window.document.getElementById('anthropic-key').value = 'k1';
      dom2.window.localStorage.setItem(a2.STORAGE_KEY, JSON.stringify({ anthropicKey: 'k1' }));
      a2.clearKeys();
      expect(dom2.window.document.getElementById('anthropic-key').value).toBe('k1');
      expect(dom2.window.localStorage.getItem(a2.STORAGE_KEY)).not.toBeNull();
    });
  });

  describe('legacy fallback order', () => {
    it('LEGACY_KEYS ordered newest-first', () => {
      expect(a.LEGACY_KEYS).toEqual([
        'triangulation_v4_1_config',
        'triangulation_v4_config',
        'triangulation_v3_1_config',
        'triangulation_v3_config',
        'triangulation_v2_config',
        'triangulation_v1_config'
      ]);
    });

    it('falls back to v4.1 storage key (the most recent legacy)', () => {
      dom.window.localStorage.setItem('triangulation_v4_1_config', JSON.stringify({
        anthropicKey: 'sk-from-v4-1'
      }));
      a.loadConfig();
      expect(get('anthropic-key')).toBe('sk-from-v4-1');
    });
  });
});
