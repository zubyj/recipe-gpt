var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getChatGPTAccessToken, ChatGPTProvider, } from '../background/chatgpt/chatgpt.js';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const accessToken = yield getChatGPTAccessToken();
            if (accessToken) {
                initAnalyzeCodeButton(new ChatGPTProvider(accessToken));
                document.getElementById('analyze-button').classList.remove('hidden');
            }
            else {
                displayLoginMessage();
            }
        }
        catch (error) {
            handleError(error);
        }
    });
}
document.getElementById('login-button').onclick = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
};
function handleError(error) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'CLOUDFLARE') {
        displayLoginMessage();
    }
    else {
        console.error('Error:', error);
        displayErrorMessage(error.message);
    }
}
function displayLoginMessage() {
    document.getElementById('login-button').classList.remove('hidden');
    document.getElementById('user-message').textContent =
        'Get your codes time & space complexity with ChatGPT login';
}
function displayErrorMessage(error) {
    document.getElementById('user-message').textContent = error;
}
function initAnalyzeCodeButton(chatGPTProvider) {
    const analyzeCodeButton = document.getElementById('analyze-button');
    analyzeCodeButton.onclick = () => __awaiter(this, void 0, void 0, function* () {
        let codeText = yield getCodeFromActiveTab();
        if (codeText) {
            processCode(chatGPTProvider, codeText);
        }
        else {
            displayUnableToRetrieveCodeMessage();
        }
    });
}
function getCodeFromActiveTab() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'getRecipe' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    }
                    else {
                        resolve(response.data);
                    }
                });
            });
        });
    });
}
function processCode(chatGPTProvider, codeText) {
    const MAX_PROMPT_LENGTH = 4000;
    const promptHeader = "Summarize the recipe. Keep it as short as possible. Return the ingredients followed by the instructions. If there is no recipe on the page, return 'no recipe found'";
    const promptText = codeText.slice(0, Math.min(codeText.length, MAX_PROMPT_LENGTH));
    document.getElementById('user-message').textContent = '';
    chatGPTProvider.generateAnswer({
        prompt: `${promptHeader}\n ${promptText}`,
        onEvent: (event) => {
            if (event.type === 'answer' && event.data) {
                document.getElementById('user-message').append(event.data.text);
                sendTextToContentScript(event.data.text);
            }
        },
    });
}
function sendTextToContentScript(text) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'addText', data: text });
    });
}
function displayUnableToRetrieveCodeMessage() {
    document.getElementById('user-message').textContent =
        'Unable to retrieve code. Please navigate to a Leetcode problem page and refresh the page.';
}
main();
