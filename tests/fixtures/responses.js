/**
 * Helpers that produce mock responses shaped like each provider's API.
 * Used by both integration and E2E tests so the same payload contract
 * is exercised everywhere.
 */

export function anthropicResponse(text, stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 }
  };
}

export function anthropicEmpty(stopReason = 'max_tokens') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    content: [],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 0 }
  };
}

export function openaiResponse(text, finishReason = 'stop') {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-5',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: finishReason
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    }
  };
}

export function openaiEmpty(finishReason = 'length', reasoningTokens = 16000) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-5',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: null },
      finish_reason: finishReason
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 16000,
      total_tokens: 16100,
      completion_tokens_details: { reasoning_tokens: reasoningTokens }
    }
  };
}

export function googleResponse(text, finishReason = 'STOP') {
  return {
    candidates: [{
      content: { parts: [{ text }], role: 'model' },
      finishReason,
      index: 0
    }],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: 150
    }
  };
}

export function googleEmpty(finishReason = 'MAX_TOKENS') {
  return {
    candidates: [{
      content: { parts: [], role: 'model' },
      finishReason,
      index: 0
    }],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 0,
      totalTokenCount: 100
    }
  };
}

export function makeFetchMock(responses) {
  /**
   * responses: array of { match: (url) => boolean, status?: number, body: object }
   * OR a function (url, init) => { status, body }
   */
  if (typeof responses === 'function') {
    return async (url, init) => {
      const result = await responses(url, init);
      return makeResponse(result.status || 200, result.body);
    };
  }
  return async (url, init) => {
    for (const r of responses) {
      if (r.match(url, init)) {
        return makeResponse(r.status || 200, r.body);
      }
    }
    throw new Error(`No mock matched URL: ${url}`);
  };
}

function makeResponse(status, body) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyText,
    headers: new Map()
  };
}

export function judgeReply(score, explanation) {
  return `SCORE: ${score}\n\nEXPLANATION:\n${explanation}`;
}
