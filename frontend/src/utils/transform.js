export const fixImagePath = (path) => {
    if (!path) return '';
    // Handle local-files path from Label Studio
    if (path.includes('/data/local-files/?d=')) {
        return path; // Already consistent with our proxy/server expectations
    }
    return path;
};

export const toPercentage = (val) => `${val}%`;
