import {
    getChatGPTAccessToken,
    ChatGPTProvider,
} from '../background/chatgpt/chatgpt.js';

async function main(): Promise<void> {
    try {
        const accessToken = await getChatGPTAccessToken();
        if (accessToken) {
            initAnalyzeCodeButton(new ChatGPTProvider(accessToken));
            document.getElementById('analyze-button')!.classList.remove('hidden');
        } else {
            displayLoginMessage();
        }
    } catch (error) {
        handleError(error as Error);
    }
}

document.getElementById('login-button')!.onclick = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
};

function handleError(error: Error): void {
    if (error.message === 'UNAUTHORIZED' || error.message === 'CLOUDFLARE') {
        displayLoginMessage();
    } else {
        console.error('Error:', error);
        displayErrorMessage(error.message);
    }
}

function displayLoginMessage(): void {
    document.getElementById('login-button')!.classList.remove('hidden');
    document.getElementById('user-message')!.textContent =
        'Get your codes time & space complexity with ChatGPT login';
}

function displayErrorMessage(error: string): void {
    document.getElementById('user-message')!.textContent = error;
}

function initAnalyzeCodeButton(chatGPTProvider: ChatGPTProvider): void {
    const analyzeCodeButton = document.getElementById('analyze-button')!;
    analyzeCodeButton.onclick = async () => {
        let codeText = await getCodeFromActiveTab();
        if (codeText) {
            processCode(chatGPTProvider, codeText);
        } else {
            displayUnableToRetrieveCodeMessage();
        }
    };
}

async function getCodeFromActiveTab(): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(
                tabs[0].id!,
                { type: 'getRecipe' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response.data);
                    }
                },
            );
        });
    });
}

// This function will truncate a string to a certain length, if it exceeds that length
function truncateString(str: string, maxLength: number) {
    return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function processCode(
    chatGPTProvider: ChatGPTProvider,
    codeText: string,
): void {
    const MAX_CHARACTERS = 16000;
    const promptHeader = "Find the recipe in the following page and summarize it. Return a bullet point list of the ingredients and measurements followed by a numbered list of instructions. If theres no recipe on the page, let me know.";
    let promptText = codeText.toString();
    promptText = promptText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ""); // Remove punctuation.
    promptText = truncateString(promptText, MAX_CHARACTERS);
    console.log(`prompt text : ${promptText}`)


    const userMessageElement = document.getElementById('user-message')!;
    userMessageElement.innerText = '';

    let fullText = '';

    chatGPTProvider.generateAnswer({
        prompt: `${promptHeader}\n ${promptText}`,
        onEvent: (event: { type: string; data?: { text: string } }) => {
            if (event.type === 'answer' && event.data) {
                fullText += event.data.text;  // accumulate the text
                userMessageElement.innerText += event.data.text;
            }

            // if (event.type === 'done') {
            //     // Once the answer is complete, format it all at once
            //     fullText = fullText.replace(/\. /g, '.\n'); // replace every '. ' with '.\n'
            //     userMessageElement.innerText += fullText;
            //     sendTextToContentScript(fullText);
            // }

            if (event.type === 'done') {
                userMessageElement.innerText += '\n\nDone!'
            }
        },
    });
}

function displayUnableToRetrieveCodeMessage(): void {
    document.getElementById('user-message')!.textContent =
        "Unable to get recipe. Please navigate to a recipe page and refresh the page.";
}

main();
