const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const ASSET_URL_KEYS = new Set([
  'imageUrl',
  'scanImageUrl',
  'gradcamUrl',
  'gradcamImageUrl',
  'annotatedImageUrl',
  'annotationImageUrl',
  'editedGradcamImageUrl',
  'avatarUrl',
  'profileImageUrl',
  'photoUrl',
  'clinicalImageUrl',
  'pdfUrl',
  'licenseFile',
  'url',
]);

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const getPublicApiOrigin = (req) => {
  const configuredOrigin = process.env.PUBLIC_API_ORIGIN || process.env.BACKEND_URL;

  if (configuredOrigin && typeof configuredOrigin === 'string') {
    return trimTrailingSlash(configuredOrigin.trim());
  }

  if (!req || typeof req.get !== 'function') {
    return '';
  }

  const host = req.get('host');
  return host ? `${req.protocol}://${host}` : '';
};

const resolveAssetUrl = (assetPath, publicOrigin = '') => {
  if (!assetPath) {
    return null;
  }

  if (typeof assetPath !== 'string') {
    return assetPath;
  }

  const trimmedPath = assetPath.trim();
  if (!trimmedPath) {
    return null;
  }

  const normalizedOrigin = trimTrailingSlash(publicOrigin || '');

  if (/^https?:\/\//i.test(trimmedPath)) {
    try {
      const url = new URL(trimmedPath);

      if (LOCAL_HOSTNAMES.has(url.hostname) && normalizedOrigin) {
        return `${normalizedOrigin}${url.pathname}${url.search}`;
      }

      return trimmedPath;
    } catch (error) {
      return trimmedPath;
    }
  }

  const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  return normalizedOrigin ? `${normalizedOrigin}${normalizedPath}` : normalizedPath;
};

const normalizeAssetUrls = (value, publicOrigin) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAssetUrls(item, publicOrigin));
  }

  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      ASSET_URL_KEYS.has(key)
        ? resolveAssetUrl(entryValue, publicOrigin)
        : normalizeAssetUrls(entryValue, publicOrigin),
    ])
  );
};

const assetUrlResponseMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => originalJson(normalizeAssetUrls(body, getPublicApiOrigin(req)));

  next();
};

module.exports = {
  ASSET_URL_KEYS,
  assetUrlResponseMiddleware,
  getPublicApiOrigin,
  normalizeAssetUrls,
  resolveAssetUrl,
};
