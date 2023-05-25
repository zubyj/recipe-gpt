import {
    getChatGPTAccessToken,
    ChatGPTProvider,
} from '../background/chatgpt/chatgpt.js';

async function retrieveAndDisplayCurrentRecipe() {
    try {
        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['recipes', 'currentRecipeIndex'], result => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });

        const recipes = result.recipes;
        currentRecipeIndex = result.currentRecipeIndex;

        // Update UI with the last viewed recipe
        document.getElementById('user-message')!.textContent = recipes[currentRecipeIndex].text;
    } catch (error) {
        console.error('Error:', error);
    }
}


async function main(): Promise<void> {
    try {
        const accessToken = await getChatGPTAccessToken();
        if (accessToken) {
            initAnalyzeCodeButton(new ChatGPTProvider(accessToken));
            document.getElementById('analyze-button')!.classList.remove('hidden');
        }
        else {
            displayLoginMessage();
        }
        // Retrieve and display the last viewed recipe when the extension is opened
        retrieveAndDisplayCurrentRecipe();
    }
    catch (error) {
        handleError(error as Error);
    }
}

let currentRecipeIndex = 0;  // Start at the first recipe.

async function cycleRecipes(direction: number) {
    try {
        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['recipes', 'currentRecipeIndex'], result => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });

        const recipes = result.recipes;
        currentRecipeIndex = result.currentRecipeIndex;

        // Update currentRecipeIndex
        currentRecipeIndex += direction;
        if (currentRecipeIndex < 0) {
            currentRecipeIndex = recipes.length - 1;  // Wrap to the last recipe.
        } else if (currentRecipeIndex >= recipes.length) {
            currentRecipeIndex = 0;  // Wrap to the first recipe.
        }

        // Update local storage
        chrome.storage.local.set({ currentRecipeIndex: currentRecipeIndex });

        // Update UI
        document.getElementById('user-message')!.textContent = recipes[currentRecipeIndex].text;

    } catch (error) {
        console.error('Error:', error);
    }
}

document.getElementById('previous-button')!.onclick = () => cycleRecipes(-1);
document.getElementById('next-button')!.onclick = () => cycleRecipes(1);


document.getElementById('login-button')!.onclick = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
};

document.getElementById('delete-button')!.onclick = () => {
    console.log('delete button clicked');
}


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
    // console.log('new text', text);
    return text
}

function processCode(
    chatGPTProvider: ChatGPTProvider,
    codeText: string,
): void {

    const promptHeader = `
    Summarize the recipe. Return 'Name' followed by name of the recipe followed by 'Ingredients' with a bullet point
    list of the ingredients and measurements followed by 'Instructions' with a numbered list of instructions.
    If no recipe on the page, return 'No recipe found'.`

    const promptText = getEssentialText(codeText.toString());

    const userMessageElement = document.getElementById('user-message')!;
    userMessageElement.innerHTML = '';
    let fullText = '';

    const currentURL = "the current URL"; // Retrieve the current URL using the chrome.tabs API

    chatGPTProvider.generateAnswer({
        prompt: `${promptHeader}\n ${promptText}`,
        onEvent: async (event: { type: string; data?: { text: string } }) => {
            if (event.type === 'answer' && event.data) {
                fullText += event.data.text;  // accumulate the text
                userMessageElement.innerHTML += event.data.text.replace(/\n/g, '<br>'); // <-- Change here
            }

            if (event.type === 'done') {
                // if text 'no recipe found' is returned, display error message
                if (fullText.toLowerCase().includes('no recipe found')) {
                    return;
                }

                // Replace newlines with <br> for displaying in HTML
                userMessageElement.innerHTML = fullText.replace(/\n/g, '<br>');

                // Save the recipe to local storage
                chrome.storage.local.get(['recipes'], (result) => {
                    let recipes = result.recipes || [];
                    recipes.push({
                        url: currentURL,
                        text: fullText,
                        title: "Title Here...",  // Replace with the actual recipe title
                    });
                    chrome.storage.local.set({ recipes: recipes, currentRecipeIndex: recipes.length - 1 });
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
