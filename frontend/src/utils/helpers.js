export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9);
}

export function getQueryParams() {
    const params = {};
    const queryString = window.location.hash.split('?')[1];
    if (queryString) {
        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            params[key] = decodeURIComponent(value);
        });
    }
    return params;
}

export function setQueryParams(params) {
    const hash = window.location.hash.split('?')[0];
    const query = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
    window.location.hash = query ? `${hash}?${query}` : hash;
}
