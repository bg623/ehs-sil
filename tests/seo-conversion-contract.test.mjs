import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const allowedCampaigns = new Set([
    'compliance_tool',
    'incident_learning_tool',
    'risk_analysis_tool',
    'training_matrix_tool',
    'glossary_tool',
    'tool_index',
    'toolbox',
    'training_library'
]);

function contentFiles() {
    return ['articles', 'topics'].flatMap((directory) =>
        fs.readdirSync(path.join(root, directory))
            .filter((name) => name.endsWith('.html'))
            .map((name) => `${directory}/${name}`)
    );
}

test('content-to-tool and content-to-product links use the shared SEO attribution contract', () => {
    const checked = [];
    for (const file of contentFiles()) {
        const html = fs.readFileSync(path.join(root, file), 'utf8').replaceAll('&amp;', '&');
        const expectedMedium = file.startsWith('articles/') ? 'article' : 'topic';
        const expectedContent = path.basename(file, '.html');
        for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
            const url = new URL(match[1], `https://ehs-sil.com/${file}`);
            if (url.hostname !== 'ehs-sil.com') continue;
            if (!/^\/(products|tools)\//.test(url.pathname)) continue;
            checked.push(`${file} -> ${url.pathname}`);
            assert.equal(url.searchParams.get('utm_source'), 'seo', `${file}: utm_source`);
            assert.equal(url.searchParams.get('utm_medium'), expectedMedium, `${file}: utm_medium`);
            assert.ok(allowedCampaigns.has(url.searchParams.get('utm_campaign')), `${file}: utm_campaign`);
            assert.equal(url.searchParams.get('utm_content'), expectedContent, `${file}: utm_content`);
        }
    }
    assert.ok(checked.length >= 30, `expected at least 30 conversion links, found ${checked.length}`);
    console.log(JSON.stringify({ status: 'PASS', conversion_links: checked.length, campaigns: [...allowedCampaigns] }));
});
