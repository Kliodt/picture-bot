const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '');

export const API = {
    getImageUrl(id) {
        return `${BASE_URL}/pictures/${id}/download`;
    },

    async getConfig({ allPictures = false } = {}) {
        const params = new URLSearchParams();
        if (!allPictures) {
            const timespanHours = 4;
            const to = new Date();
            const from = new Date(to.getTime() - timespanHours * 3_600_000);
            params.set('from_date', from.toISOString());
            params.set('to_date', to.toISOString());
        }
        const resp = await fetch(`${BASE_URL}/pictures?${params}`);
        if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`);
        return resp.json();
    },

    async getImageBlob(id) {
        const resp = await fetch(this.getImageUrl(id));
        if (!resp.ok) throw new Error(`Image ${id} fetch failed: ${resp.status}`);
        return URL.createObjectURL(await resp.blob());
    },
};
