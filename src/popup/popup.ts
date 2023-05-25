import {
    getChatGPTAccessToken,
    ChatGPTProvider,
} from '../background/chatgpt/chatgpt.js';

async function main(): Promise<void> {
    try {
        const accessToken = await getChatGPTAccessToken();
        if (accessToken) {
            initAnalyzeCodeButton(new ChatGPTProvider(accessToken));
            if (accessToken) {
                initAnalyzeCodeButton(new ChatGPTProvider(accessToken));
                chrome.storage.local.get(['lastUserMessage'], function (result) {
                    if (result.lastUserMessage) {
                        document.getElementById('user-message')!.innerHTML = result.lastUserMessage.replace(/\n/g, '<br>'); // <-- Change here
                    }
                });
                document.getElementById('analyze-button')!.classList.remove('hidden');
            }
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
        'Please login to ChatGPT to use this extension.';
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

// get the essential text from the page before sending to gpt
function getEssentialText(text: string) {
    const MAX_LEN = 15000;
    text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ""); // Remove punctuation.
    text = text.replace(/<img[^>]*>/g, ""); // Remove images. 
    text = text.length > MAX_LEN ? text.slice(0, MAX_LEN) : text // Truncate to max length.
    console.log('new text', text);
    return text
}

function processCode(
    chatGPTProvider: ChatGPTProvider,
    codeText: string,
): void {

    const promptHeader = `
    Summarize the recipe. Return 'Name' followed by name of the recipe followed by 'Ingredients' with a bullet point
    list of the ingredients and measurements followed by 'Instructions' with a numbered list of instructions.
    If no recipe on the page, let me know.`

    const promptText = getEssentialText(codeText.toString());

    const userMessageElement = document.getElementById('user-message')!;
    userMessageElement.innerHTML = ''; // <-- Change here
    let fullText = '';

    chatGPTProvider.generateAnswer({
        prompt: `${promptHeader}\n ${promptText}`,
        onEvent: (event: { type: string; data?: { text: string } }) => {
            if (event.type === 'answer' && event.data) {
                fullText += event.data.text;  // accumulate the text
                userMessageElement.innerHTML += event.data.text.replace(/\n/g, '<br>'); // <-- Change here
            }

            if (event.type === 'done') {
                // Replace newlines with <br> for displaying in HTML
                userMessageElement.innerHTML = fullText.replace(/\n/g, '<br>');
                chrome.storage.local.set({ 'lastUserMessage': fullText }, () => {
                    console.log('User message saved');
                });
            }
        },
    });
}

function displayUnableToRetrieveCodeMessage(): void {
    document.getElementById('user-message')!.textContent =
        "Unable to find recipe on current page. Please refresh the page or try another page.";
}

main();
