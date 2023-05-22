/*
ExpiryMap is used to store key-value pairs with expiration time.
It caches the access token returned by getChatGPTAccessToken() for 10 seconds.
If the token is requested again within the expiration time, it is retrieved from the cache.
*/
class ExpiryMap {
    constructor(expiryMs) {
        this.expiryMs = expiryMs;
        this.map = new Map();
        this.timeouts = new Map();
    }
    get(key) {
        return this.map.get(key);
    }
    set(key, value) {
        this.clearTimeout(key);
        this.map.set(key, value);
        this.timeouts.set(key, setTimeout(() => {
            this.delete(key);
        }, this.expiryMs));
    }
    delete(key) {
        this.clearTimeout(key);
        this.map.delete(key);
    }
    clearTimeout(key) {
        const timeout = this.timeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(key);
        }
    }
}
export { ExpiryMap as default };
