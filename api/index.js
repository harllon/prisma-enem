const app = require("../server");

function restoreOriginalPathFromRewrite(req) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (requestUrl.pathname !== "/api/index") return;

  const originalPath = requestUrl.searchParams.get("path");
  if (originalPath === null) return;

  requestUrl.searchParams.delete("path");
  const normalizedPath = `/${originalPath}`.replace(/\/+/g, "/");
  const query = requestUrl.searchParams.toString();
  req.url = query ? `${normalizedPath}?${query}` : normalizedPath;
}

module.exports = function handler(req, res) {
  restoreOriginalPathFromRewrite(req);
  return app(req, res);
};
