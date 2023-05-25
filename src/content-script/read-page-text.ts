chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getRecipe') {
        sendResponse({ data: getPageText() });
    }
});

function getPageText() {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                let parent = node.parentNode.nodeName.toLowerCase();
                if (parent === 'script' || parent === 'style' || parent === 'a') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let textArray = [];
    while (walker.nextNode()) {
        textArray.push(walker.currentNode.textContent.trim());
    }
    return textArray;
}
