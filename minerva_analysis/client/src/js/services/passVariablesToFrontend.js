function passVariablesToFrontend(vars) {
    return vars
}

function minervaBaseUrl() {
    const base = window.MINERVA_BASE_URL || "";
    if (!base || base === "/") {
        return "";
    }
    return "/" + String(base).replace(/^\/+|\/+$/g, "");
}

function minervaUrl(path) {
    const normalizedPath = String(path || "").replace(/^\/+/, "");
    const base = minervaBaseUrl();
    if (!normalizedPath) {
        return base || "/";
    }
    return (base ? base + "/" : "/") + normalizedPath;
}
