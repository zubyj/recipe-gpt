import {
    getChatGPTAccessToken,
    ChatGPTProvider,
} from '../background/chatgpt/chatgpt.js';

let currentRecipeIndex = 0;
let message = document.getElementById('message');

function handleError(error: Error): void {
    if (error.message === 'UNAUTHORIZED' || error.message === 'CLOUDFLARE') {
        displayLoginMessage();
    } else {
        console.error('Error:', error);
        message!.textContent = error.message;
    }
}

function displayLoginMessage(): void {
    document.getElementById('login-button')!.classList.remove('hidden');
    message!.textContent = 'Please login to ChatGPT to use this extension.';
}

/* 
    Attach onclick events to buttons
*/
function initGetRecipeBtn(chatGPTProvider: ChatGPTProvider): void {
    const getRecipeBtn = document.getElementById('get-recipe-btn')!;
    getRecipeBtn.onclick = async () => {
        let codeText = await getCodeFromActiveTab();
        if (codeText) {
            getRecipeFromGPT(chatGPTProvider, codeText);
        } else {
            message!.textContent = "Unable to find recipe on current page. Please refresh the page or try another page.";
        }
    };
}


async function main(): Promise<void> {
    try {
        const accessToken = await getChatGPTAccessToken();
        if (accessToken) {
            initGetRecipeBtn(new ChatGPTProvider(accessToken));
            const getRecipeBtn = document.getElementById('get-recipe-btn');
            getRecipeBtn?.classList.remove('hidden');
        } else {
            displayLoginMessage();
        }

        retrieveAndDisplayCurrentRecipe();
    } catch (error) {
        handleError(error as Error);
    }
}

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
        if (!recipes || recipes.length === 0) {
            document.getElementById('recipes')!.textContent = "No recipes added.";
        }
        else {

            document.getElementById('recipes')!.innerHTML = recipes[currentRecipeIndex].text;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}


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
        if (recipes && recipes.length > 0) {
            document.getElementById('recipes')!.innerHTML = recipes[currentRecipeIndex].text;

        }
        else {
            document.getElementById('recipes')!.textContent = "No recipes added.";
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteCurrentRecipe() {
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

        let recipes = result.recipes;
        let currentRecipeIndex = result.currentRecipeIndex;

        // Remove the current recipe from the array.
        recipes.splice(currentRecipeIndex, 1);

        // If there are no recipes left, display a message.
        if (recipes.length === 0) {
            message!.textContent = "No recipes added.";
        } else {
            // If the deleted recipe was the last one in the array, update the currentRecipeIndex to be the new last recipe.
            if (currentRecipeIndex === recipes.length) {
                currentRecipeIndex -= 1;
            }
        }

        // Update local storage with the new recipes array and the new currentRecipeIndex.
        chrome.storage.local.set({ recipes: recipes, currentRecipeIndex: currentRecipeIndex });
        cycleRecipes(1);
    } catch (error) {
        console.error('Error:', error);
    }
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
    return text
}


function getRecipeFromGPT(
    chatGPTProvider: ChatGPTProvider,
    codeText: string,
): void {

    const promptHeader = `
    Summarize the recipe.
    If no recipe on the page, return 'No recipe found'. 
    Else, do the following:
    Return 'Name' followed by name of the recipe followed by 'Ingredients' 
    with a bullet point list of the ingredients and measurements 
    followed by 'Instructions' with a numbered list of instructions.
    `

    const promptText = getEssentialText(codeText.toString());
    message!.innerHTML = '';

    let fullText = '';
    const currentURL = "the current URL"; // Retrieve the current URL using the chrome.tabs API
    message!.classList.remove('hidden');

    chatGPTProvider.generateAnswer({
        prompt: `${promptHeader}\n ${promptText}`,
        onEvent: async (event: { type: string; data?: { text: string } }) => {
            if (event.type === 'answer' && event.data) {
                fullText += event.data.text;
                message!.innerHTML = fullText.replace(/\n/g, '<br>');
            }

            if (event.type === 'done') {
                message!.classList.add('hidden');
                if (fullText.length < 25) {
                    return;
                }
                // Save the recipe to local storage
                chrome.storage.local.get(['recipes'], (result) => {
                    let recipes = result.recipes || [];
                    recipes.push({
                        url: currentURL,
                        text: message!.innerText,
                        title: "Title Here...",  // Replace with the actual recipe title
                    });
                    chrome.storage.local.set({ recipes: recipes, currentRecipeIndex: recipes.length - 1 });
                    retrieveAndDisplayCurrentRecipe()
                });
            }
        },
    });
}

const previousButton = document.getElementById('previous-button');
if (previousButton) {
    previousButton.onclick = () => cycleRecipes(-1);
}

const nextButton = document.getElementById('next-button');
if (nextButton) {
    nextButton.onclick = () => cycleRecipes(1);
}

const loginButton = document.getElementById('login-button');
if (loginButton) {
    loginButton.onclick = () => {
        chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
    };
}

const deleteButton = document.getElementById('delete-button');
if (deleteButton) {
    deleteButton.onclick = deleteCurrentRecipe;
}

main();
