var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import ExpiryMap from './expiry-map.js';
import { uuidv4 } from './uuid.js';
import { fetchSSE } from './fetch-sse.js';
const KEY_ACCESS_TOKEN = 'accessToken';
const cache = new ExpiryMap(10 * 1000);
export function getChatGPTAccessToken() {
    return __awaiter(this, void 0, void 0, function* () {
        if (cache.get(KEY_ACCESS_TOKEN)) {
            return cache.get(KEY_ACCESS_TOKEN);
        }
        const resp = yield fetch('https://chat.openai.com/api/auth/session');
        if (resp.status === 403) {
            throw new Error('CLOUDFLARE');
        }
        const data = yield resp.json().catch(() => ({}));
        if (!data.accessToken) {
            throw new Error('UNAUTHORIZED');
        }
        cache.set(KEY_ACCESS_TOKEN, data.accessToken);
        return data.accessToken;
    });
}
// Mangages interactions with the OpenAI Chat API.
export class ChatGPTProvider {
    constructor(token) {
        this.token = token;
        this.modelName = 'gpt-3.5-turbo';
    }
    generateAnswer(params) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetchSSE('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: params.prompt,
                        },
                    ],
                    model: this.modelName,
                    stream: true,
                    user: uuidv4(),
                }),
                onMessage(message) {
                    console.debug('sse message', message);
                    if (message === '[DONE]') {
                        params.onEvent({ type: 'done' });
                        return;
                    }
                    let data;
                    try {
                        data = JSON.parse(message);
                    }
                    catch (err) {
                        console.error(err);
                        return;
                    }
                    const text = data.choices[0].delta.content;
                    if (text) {
                        params.onEvent({
                            type: 'answer',
                            data: {
                                text,
                            },
                        });
                    }
                },
            });
        });
    }
}
