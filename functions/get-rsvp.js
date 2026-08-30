// netlify/functions/get-rsvp.js
//
// Lit les réponses du formulaire Netlify "rsvp" et les renvoie au format
// attendu par le tableau de bord admin du site.
//
// Nécessite deux variables d'environnement, à ajouter dans
// Netlify > Site settings > Environment variables :
//   NETLIFY_API_TOKEN  -> un "Personal access token" créé dans
//                          Netlify > User settings > Applications
//   NETLIFY_SITE_ID    -> l'ID du site, visible dans
//                          Site settings > General > Site details
//
// Utilise le module natif "https" (pas de dépendance externe, pas de fetch)
// pour fonctionner quelle que soit la version de Node utilisée par Netlify.

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
          resolve(data ? JSON.parse(data) : []);
        } catch (err) {
          reject(new Error(`Réponse Netlify illisible sur ${path} : ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function () {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!token || !siteId) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'NETLIFY_API_TOKEN ou NETLIFY_SITE_ID manquant.',
        hasToken: Boolean(token),
        hasSiteId: Boolean(siteId)
      })
    };
  }

  try {
    const forms = await apiRequest(`/api/v1/sites/${siteId}/forms`);
    if (!Array.isArray(forms)) {
      throw new Error('La réponse "forms" n\'est pas une liste — vérifiez NETLIFY_SITE_ID.');
    }

    const form = forms.find((f) => f.name === 'rsvp');
    if (!form) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      };
    }

    const submissions = await apiRequest(`/api/v1/forms/${form.id}/submissions`);

    const mapped = (submissions || []).map((s) => {
      const d = s.data || {};
      const adults = parseInt(d.adultes || '0', 10) || 0;
      const children = parseInt(d.enfants || '0', 10) || 0;
      return {
        id: s.id,
        name: d.nom || '',
        email: d.email || '',
        phone: d.telephone || '',
        attending: d.attending || '',
        adults,
        children,
        guests: adults + children,
        carpool: d.covoiturage === 'oui',
        brunch: d.brunch || '',
        diet: d.regime || '',
        song: d.chanson || '',
        message: d.message || '',
        receivedAt: s.created_at
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
