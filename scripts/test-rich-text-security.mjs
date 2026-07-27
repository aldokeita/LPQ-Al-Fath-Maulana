import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { sanitizeRichText } from '../src/lib/richTextSanitizer.js';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');

const sanitized = sanitizeRichText(`
  <h2 onclick="alert(1)">Judul Aman</h2>
  <p><strong>Isi lama</strong> dengan <em>format</em>.</p>
  <script>alert('xss')</script>
  <img src=x onerror="alert(2)">
  <iframe srcdoc="<script>alert(3)</script>"></iframe>
  <a href="javascript:alert(4)" target="_blank">Bahaya</a>
  <a href="https://lpqalfathmaulana.id/berita" target="_blank" rel="noopener">Aman</a>
  <img src="https://lpqalfathmaulana.id/logo.webp" alt="Logo aman">
  <img src="data:image/svg+xml,&lt;svg onload=alert(5)&gt;" alt="Logo bahaya">
`, window);

assert.match(sanitized, /<h2>Judul Aman<\/h2>/);
assert.match(sanitized, /<strong>Isi lama<\/strong>/);
assert.match(sanitized, /<em>format<\/em>/);
assert.match(sanitized, /href="https:\/\/lpqalfathmaulana\.id\/berita"/);
assert.match(sanitized, /src="https:\/\/lpqalfathmaulana\.id\/logo\.webp"/);
assert.doesNotMatch(sanitized, /script|iframe|onclick|onerror|javascript:|srcdoc|data:image/i);

assert.equal(sanitizeRichText(null, window), '');
assert.equal(sanitizeRichText('<p style="color:red">Teks</p>', window), '<p>Teks</p>');
assert.equal(sanitizeRichText('<a href="mailto:admin@example.com">Email</a>', window), '<a href="mailto:admin@example.com">Email</a>');

const [editorSource, packageJson] = await Promise.all([
  readFile(new URL('../src/components/RichTextEditor.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);

assert.match(editorSource, /from ['"]react-quill-new['"]/);
assert.match(editorSource, /sanitizeRichText\(html\)/);
assert.match(editorSource, /['"]image['"]/);
assert.doesNotMatch(packageJson, /["']react-quill["']\s*:/);

console.log('rich-text security checks passed');
