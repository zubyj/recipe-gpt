import {
    getChatGPTAccessToken,
    ChatGPTProvider,
} from '../background/chatgpt/chatgpt.js';

let currentRecipeIndex = 0;
let message = document.getElementById('message');
let infoMessage = document.getElementById('info-message');
let savedRecipes = document.getElementById('saved-recipes');
let recipeSelector = document.getElementById('recipe-selector');


// Buttons
let getRecipeBtn = document.getElementById('get-recipe-btn');
let toggleRecipesBtn = document.getElementById('toggle-recipes-btn');
let deleteBtn = document.getElementById('delete-button');
let prevBtn = document.getElementById('previous-button');
let nextBtn = document.getElementById('next-button');
let recipeUrl = document.getElementById('recipe-url');
let buttons = [getRecipeBtn, toggleRecipesBtn, deleteBtn, prevBtn, nextBtn, recipeUrl];

function handleError(error: Error): void {
    if (error.message === 'UNAUTHORIZED' || error.message === 'CLOUDFLARE') {
        displayLoginMessage();
    } else {
        console.error('Error:', error);
    }
}

function enableButtons() {
    buttons.forEach(button => button.disabled = false);
}

function disableButtons() {
    buttons.forEach(button => button.disabled = true);
}


function displayLoginMessage(): void {
    document.getElementById('login-button')!.classList.remove('hidden');
    retrieveAndDisplayCurrentRecipe();
    getRecipeBtn!.classList.add('hidden');
    infoMessage!.textContent = "Please login to ChatGPT to summarize recipes.";
}

/* 
    On click, asks ChatGPT to summarize the recipe on the current page.
*/
function initGetRecipeBtn(chatGPTProvider: ChatGPTProvider): void {
    getRecipeBtn!.onclick = async () => {
        let recipe = await getRecipeFromActiveTab();
        if (recipe) {
            getRecipeFromGPT(chatGPTProvider, recipe);
        } else {
            infoMessage!.textContent = "Cant find recipe. Please refresh the page or try another page.";
        }
    };
}

function populateRecipeSelector(recipes) {
    // First clear all existing options
    recipeSelector!.innerHTML = '';
    // Then populate with the updated list of recipes
    if (recipes.length == 0) {
        const option = document.createElement('option');
        option.text = 'No recipes added';
        recipeSelector!.appendChild(option);
        return;
    }
    if (recipes) {
        recipes.forEach((recipe, index: number) => {
            const option = document.createElement('option');
            option.text = recipe.title;
            option.value = index.toString();
            if (index === currentRecipeIndex) option.selected = true;
            recipeSelector!.appendChild(option);
        });
    }
}

async function main(): Promise<void> {
    try {
        const accessToken = await getChatGPTAccessToken();
        if (accessToken) {
            initGetRecipeBtn(new ChatGPTProvider(accessToken));
            initCopyBtn();
            getRecipeBtn!.classList.remove('hidden');
        } else {
            displayLoginMessage();
        }

        retrieveAndDisplayCurrentRecipe();

        // Add event listener for when the selected option in the dropdown changes
        recipeSelector!.addEventListener('change', (e) => {
            currentRecipeIndex = parseInt((e.target as HTMLSelectElement).value);
            retrieveAndDisplayCurrentRecipe(currentRecipeIndex);
        });

        if (prevBtn) {
            prevBtn.onclick = () => cycleRecipes(-1);
        }

        if (nextBtn) {
            nextBtn.onclick = () => cycleRecipes(1);
        }

        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.onclick = () => {
                chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
            };
        }

        if (deleteBtn) {
            deleteBtn.onclick = deleteCurrentRecipe;
        }

        // Get a reference to the button and the recipe paragraph
        if (toggleRecipesBtn) {
            toggleRecipesBtn.onclick = () => {
                // Check if the recipes paragraph is currently visible
                if (savedRecipes!.style.display !== 'none') {
                    // If it is visible, hide it and change the button image to 'show-icon'
                    savedRecipes!.style.display = 'none';
                    toggleRecipesBtn!.innerHTML = `
                    <img src="../../src/assets/images/button/show-icon.png" alt="Show" />
                `;
                } else {
                    // If it's not visible, show it and change the button image to 'hide-icon'
                    savedRecipes!.style.display = 'block';
                    toggleRecipesBtn!.innerHTML = `
                    <img src="../../src/assets/images/button/hide-icon.png" alt="Hide" />
                `;
                }
            };
        }
    } catch (error) {
        handleError(error as Error);
    }
}

async function retrieveAndDisplayCurrentRecipe(recipeIndex: number | null = null): Promise<void> {
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
        currentRecipeIndex = recipeIndex !== null ? recipeIndex : result.currentRecipeIndex;

        // Update UI with the last viewed recipe
        if (!recipes || recipes.length === 0) {
            savedRecipes!.textContent = "Recipes will appear here";
        }
        else {
            // Display recipe text and URL
            savedRecipes!.innerHTML = recipes[currentRecipeIndex].text;
            recipeUrl?.classList.remove('hidden');
            recipeUrl!.setAttribute('href', recipes[currentRecipeIndex].url); // <-- This line sets the URL

        }

        populateRecipeSelector(recipes);

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

        recipeSelector!.selectedIndex = currentRecipeIndex;

        // Update UI
        if (recipes && recipes.length > 0) {
            savedRecipes!.innerHTML = recipes[currentRecipeIndex].text;

        }
        else {
            savedRecipes!.textContent = "No recipes added.";
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

        if (currentRecipeIndex === recipes.length) {
            currentRecipeIndex -= 1;
        }

        // Update local storage with the new recipes array and the new currentRecipeIndex.
        chrome.storage.local.set({ recipes: recipes, currentRecipeIndex: currentRecipeIndex });
        populateRecipeSelector(recipes); // Add this line to update the dropdown
        cycleRecipes(1);
    } catch (error) {
        console.error('Error:', error);
    }
}


async function getRecipeFromActiveTab(): Promise<string | null> {
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

    let recipeBtnText = getRecipeBtn!.innerHTML;
    getRecipeBtn!.innerText = 'Summarizing the recipe...';
    disableButtons();


    const promptHeader = `
    I scraped the following text from a website. I'm trying to find a recipe in the text.
    If you dont see a recipe in the text, return 'No recipe found'.
    Otherwise, I want you to return the summary of the recipe in two sections:
    1. Return 'Ingredients' with a bullet point list of the ingredients and measurements
    2. Return 'Instructions' with a numbered list of instructions
    Dont return anything else.
    Add a newline between each section.
    `
    const promptText = getEssentialText(codeText.toString());
    message!.innerHTML = '';
    infoMessage!.classList.add('hidden');


    let fullText = '';
    let currentURL = "";
    let title = ""

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        title = tabs[0].title;
        currentURL = tabs[0].url

        recipeSelector!.innerHTML = '';
        // Then populate with the updated list of recipes
        const option = document.createElement('option');
        option.text = title;
        recipeSelector!.appendChild(option);
    });

    message!.classList.remove('hidden');
    savedRecipes!.classList.add('hidden');

    chatGPTProvider.generateAnswer({
        prompt: `${promptHeader}\n ${promptText}`,
        onEvent: async (event: { type: string; data?: { text: string } }) => {

            if (event.type === 'answer' && event.data) {
                fullText += event.data.text;
                message!.innerHTML = fullText.replace(/\n/g, '<br>');
            }

            if (event.type === 'done') {
                enableButtons();

                getRecipeBtn!.innerHTML = recipeBtnText;
                message!.classList.add('hidden');
                savedRecipes!.classList.remove('hidden');
                if (fullText.length < 25) {
                    infoMessage!.textContent = 'No recipe found on the page.';
                    // Do not clear the recipeSelector if no recipe was found
                    return;
                }
                // Save the recipe to local storage
                chrome.storage.local.get(['recipes'], (result) => {
                    let recipes = result.recipes || [];
                    recipes.push({
                        url: currentURL,
                        text: message?.innerHTML,
                        title: title,  // Replace with the actual recipe title
                    });
                    chrome.storage.local.set({ recipes: recipes, currentRecipeIndex: recipes.length - 1 });
                    // Clear the recipeSelector and populate it with the updated list of recipes
                    recipeSelector!.innerHTML = '';
                    const option = document.createElement('option');
                    option.text = title;
                    recipeSelector!.appendChild(option);
                    retrieveAndDisplayCurrentRecipe()
                });
            }
        },
    });
}

function copyRecipeToClipboard(): void {
    // Get the recipe text
    let recipeText = savedRecipes!.innerText;
    // Copy the text to clipboard
    navigator.clipboard.writeText(recipeText)
        .then(() => {
            // Successful copy
            infoMessage!.textContent = "Recipe copied to clipboard.";
        })
        .catch((error) => {
            // Unsuccessful copy
            console.error("Error:", error);
            infoMessage!.textContent = "Failed to copy recipe. Please try again.";
        });
}

let copyBtn = document.getElementById('copy-button');
buttons.push(copyBtn);

function initCopyBtn(): void {
    copyBtn!.onclick = () => {
        copyRecipeToClipboard();
    };
}


main();
