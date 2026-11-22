// Read-only production smoke test. Use GET: OSS currently handles HEAD differently.
const origin = 'https://ehs-sil.com';
const canonical = `${origin}/articles/index.html`;

async function get(path) {
  const response = await fetch(new URL(path, origin), {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    location: response.headers.get('location'),
    body: await response.text(),
  };
}

function redirectsToIndex(result, path) {
  if (![301, 308].includes(result.status) || !result.location) return false;
  const target = new URL(result.location, new URL(path, origin));
  return target.href === canonical;
}

function isArticleIndex(result) {
  return result.status === 200
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/ehs-sil\.com\/articles\/index\.html["']/i.test(result.body)
    && /<h1\b[^>]*>[^<]*文章/i.test(result.body)
    && /"@type"\s*:\s*"CollectionPage"/.test(result.body);
}

try {
  const issues = [];
  const exact = await get('/articles/index.html');
  if (!isArticleIndex(exact)) issues.push(`GET /articles/index.html should be the article index; got ${exact.status}`);

  const alias = await get('/articles/');
  if (!(redirectsToIndex(alias, '/articles/') || isArticleIndex(alias))) {
    issues.push(`GET /articles/ should redirect permanently or serve the real index; got ${alias.status}`);
  }

  for (const path of ['/articles/articles/', '/articles/articles/articles/']) {
    const result = await get(path);
    if (!([404, 410].includes(result.status) || redirectsToIndex(result, path))) {
      issues.push(`GET ${path} should be 404/410 or redirect permanently to the index; got ${result.status}`);
    }
  }

  const unknown = await get('/seo-route-smoke-missing-20261122/');
  if (![404, 410].includes(unknown.status)) {
    issues.push(`GET unknown directory should be 404/410; got ${unknown.status}`);
  }

  if (issues.length) throw new Error(issues.join('; '));
  console.log(JSON.stringify({ status: 'PASS', method: 'GET', checked: 5 }));
} catch (error) {
  console.error(`Article route smoke test failed: ${error.message}`);
  process.exitCode = 1;
}
