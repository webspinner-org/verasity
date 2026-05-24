import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_PATH = resolve(__dirname, '../../app/triangulation.html');

let cachedHtml = null;

function getHtml() {
  if (cachedHtml === null) {
    cachedHtml = readFileSync(APP_PATH, 'utf-8');
  }
  return cachedHtml;
}

/**
 * Creates a fresh JSDOM instance with the Triangulation app loaded and
 * its inline script executed. Returns the JSDOM dom; access globals via
 * dom.window.
 *
 * @param {Object} options
 * @param {boolean} [options.confirm=true] - default response to window.confirm
 * @returns {JSDOM}
 */
export function loadApp(options = {}) {
  const html = getHtml();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });

  const { window } = dom;
  window.confirm = () => options.confirm !== false;
  window.alert = () => {};

  return dom;
}

export function api(dom) {
  const w = dom.window;
  return {
    escapeHTML: w.escapeHTML,
    renderMarkdown: w.renderMarkdown,
    renderSynthesisMarkdown: w.renderSynthesisMarkdown,
    parseJudgeReply: w.parseJudgeReply,
    scoreClass: w.scoreClass,
    buildJudgePrompt: w.buildJudgePrompt,
    buildSynthesisPrompt: w.buildSynthesisPrompt,
    computeSynthesisStats: w.computeSynthesisStats,
    callAnthropic: w.callAnthropic,
    callOpenAI: w.callOpenAI,
    callGoogle: w.callGoogle,
    fireJudge: w.fireJudge,
    fireSource: w.fireSource,
    fireSynthesis: w.fireSynthesis,
    fireScrub: w.fireScrub,
    sendPrompt: w.sendPrompt,
    runScrub: w.runScrub,
    clearScrub: w.clearScrub,
    buildScrubPrompt: w.buildScrubPrompt,
    computeScrubStats: w.computeScrubStats,
    renderScrubMarkdown: w.renderScrubMarkdown,
    saveConfig: w.saveConfig,
    loadConfig: w.loadConfig,
    clearKeys: w.clearKeys,
    clearResponses: w.clearResponses,
    getCfg: w.getCfg,
    setVerdict: w.setVerdict,
    setPanel: w.setPanel,
    setSynthesisStatus: w.setSynthesisStatus,
    setSynthesisBody: w.setSynthesisBody,
    showTab: w.showTab,
    runState: w.runState,
    EmptyResponseError: w.EmptyResponseError,
    DISPLAY: w.DISPLAY,
    PROVIDERS: w.PROVIDERS,
    TOKEN_BUDGETS: w.TOKEN_BUDGETS,
    SYNTHESIS_MAX_TOKENS: w.SYNTHESIS_MAX_TOKENS,
    SCRUB_MAX_TOKENS: w.SCRUB_MAX_TOKENS,
    PROVIDER_CALL: w.PROVIDER_CALL,
    STORAGE_KEY: w.STORAGE_KEY,
    LEGACY_KEYS: w.LEGACY_KEYS,
    ANNOTATION_TITLES: w.ANNOTATION_TITLES,
    window: w,
    document: w.document
  };
}

export function getAppHtml() {
  return getHtml();
}
