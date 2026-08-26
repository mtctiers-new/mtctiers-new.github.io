const https = require('https');
const http = require('http');
const crypto = require('crypto');

function fetchBufferWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    if (!url || typeof url !== 'string') return reject(new Error('Invalid URL'));

    const client = url.startsWith('https') ? https : http;
    const reqHeaders = {
      'User-Agent': 'MTCTiersBot/1.0 (https://mtctiers-new.github.io)'
    };

    client.get(url, { headers: reqHeaders }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return resolve(fetchBufferWithRedirects(redirectUrl, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    }).on('error', reject);
  });
}

function uploadToCatbox(imageUrl) {
  return new Promise(async (resolve) => {
    if (!imageUrl || typeof imageUrl !== 'string') return resolve(imageUrl);
    if (imageUrl.includes('catbox.moe')) return resolve(imageUrl);

    try {
      const { buffer, contentType } = await fetchBufferWithRedirects(imageUrl);
      const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
      
      let ext = 'png';
      if (contentType && contentType.includes('jpeg')) ext = 'jpg';
      else if (contentType && contentType.includes('webp')) ext = 'webp';
      else if (contentType && contentType.includes('gif')) ext = 'gif';

      const head = `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="image.${ext}"\r\nContent-Type: ${contentType || 'image/png'}\r\n\r\n`;
      const tail = `\r\n--${boundary}--\r\n`;
      
      const payload = Buffer.concat([Buffer.from(head), buffer, Buffer.from(tail)]);
      
      const req = https.request({
        hostname: 'catbox.moe',
        path: '/user/api.php',
        method: 'POST',
        headers: {
          'User-Agent': 'MTCTiersBot/1.0 (https://mtctiers-new.github.io)',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length
        }
      }, catRes => {
        let body = '';
        catRes.on('data', c => body += c);
        catRes.on('end', () => {
          const finalUrl = body.trim();
          if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
            console.log(`🐱 Uploaded image to Catbox: ${finalUrl}`);
            resolve(finalUrl);
          } else {
            console.warn('Catbox upload response error:', finalUrl);
            resolve(imageUrl);
          }
        });
      });

      req.on('error', err => {
        console.warn('Catbox upload network error:', err.message);
        resolve(imageUrl);
      });

      req.write(payload);
      req.end();
    } catch (err) {
      console.warn('Catbox fetch image error:', err.message);
      resolve(imageUrl);
    }
  });
}

module.exports = { uploadToCatbox };
