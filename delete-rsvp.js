// netlify/functions/delete-rsvp.js
//
// Supprime une réponse RSVP depuis le tableau de bord admin.
// Utilise les mêmes variables d'environnement que get-rsvp.js :
//   NETLIFY_API_TOKEN, NETLIFY_SITE_ID
//
// Utilise le module natif "https" (pas de dépendance externe, pas de fetch).

const https = require('https');

function apiRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.netlify.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Netlify API (${res.statusCode}) sur ${path} : ${data}`));
          return;
        }
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (err) {
          resolve({});
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'NETLIFY_API_TOKEN manquant.' }) };
  }

  try {
    const { id } = JSON.parse(event.body || '{}');
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Identifiant de réponse manquant.' }) };
    }

    await apiRequest(`/api/v1/submissions/${id}`, 'DELETE');

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
