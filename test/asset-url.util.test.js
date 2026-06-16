const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeAssetUrls,
  resolveAssetUrl,
} = require('../src/utils/asset-url.util');

test('resolveAssetUrl rewrites localhost absolute URLs to public origin', () => {
  const result = resolveAssetUrl(
    'http://localhost:3300/uploads/scan_xxx.jpg?size=large',
    'https://myskin-api-prod-production.up.railway.app/'
  );

  assert.equal(
    result,
    'https://myskin-api-prod-production.up.railway.app/uploads/scan_xxx.jpg?size=large'
  );
});

test('resolveAssetUrl prefixes upload paths with public origin', () => {
  assert.equal(
    resolveAssetUrl('/uploads/scan_xxx.jpg', 'https://api.example.com'),
    'https://api.example.com/uploads/scan_xxx.jpg'
  );
  assert.equal(
    resolveAssetUrl('uploads/scan_xxx.jpg', 'https://api.example.com'),
    'https://api.example.com/uploads/scan_xxx.jpg'
  );
});

test('normalizeAssetUrls recursively normalizes known asset response fields', () => {
  const result = normalizeAssetUrls({
    data: [{
      imageUrl: '/uploads/scan.jpg',
      scan: {
        gradcamUrl: 'http://127.0.0.1:3300/uploads/gradcam/g.jpg',
        annotationImageUrl: null,
      },
      message: 'leave me alone',
    }],
  }, 'https://api.example.com');

  assert.equal(result.data[0].imageUrl, 'https://api.example.com/uploads/scan.jpg');
  assert.equal(result.data[0].scan.gradcamUrl, 'https://api.example.com/uploads/gradcam/g.jpg');
  assert.equal(result.data[0].scan.annotationImageUrl, null);
  assert.equal(result.data[0].message, 'leave me alone');
});
