// netlify/functions/proxy.js

let currentNgrokUrl = process.env.NGROK_TARGET_URL || null;
const API_SECRET_KEY = process.env.API_SECRET_KEY; // Récupère la clé secrète des variables d'environnement Netlify

exports.handler = async (event, context) => {
  const { path, httpMethod, headers, queryStringParameters, body } = event;

  // Endpoint pour mettre à jour l'URL Ngrok
  if (path === '/api/update-ngrok-url' && httpMethod === 'POST') {
    const providedKey = headers['x-api-key'];
    if (!providedKey || providedKey !== API_SECRET_KEY) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized: Invalid API Key' }),
      };
    }

    try {
      const newUrl = JSON.parse(body).ngrokUrl;
      if (newUrl && newUrl.startsWith('https://')) {
        currentNgrokUrl = newUrl;
        console.log(`Ngrok URL updated to: ${currentNgrokUrl}`);
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'URL updated successfully' }),
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid URL provided' }),
        };
      }
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid JSON body', error: error.message }),
      };
    }
  }

  // Endpoint proxy pour rediriger/proxifier vers l'URL Ngrok
  if (currentNgrokUrl) {
    try {
      // Construire l'URL cible en ajoutant le chemin de la requête originale
      const targetUrl = new URL(path, currentNgrokUrl);
      for (const key in queryStringParameters) {
        targetUrl.searchParams.append(key, queryStringParameters[key]);
      }

      // Supprimer les en-têtes qui peuvent causer des problèmes de proxy
      delete headers['host'];
      delete headers['x-netlify-original-pathname'];
      delete headers['x-netlify-original-path'];
      delete headers['x-netlify-original-uri'];

      const response = await fetch(targetUrl.toString(), {
        method: httpMethod,
        headers: headers,
        body: body,
      });

      const responseBody = await response.text();

      return {
        statusCode: response.status,
        headers: response.headers.raw(),
        body: responseBody,
      };
    } catch (error) {
      console.error('Proxy error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Proxy failed', error: error.message }),
      };
    }
  } else {
    return {
      statusCode: 503,
      body: JSON.stringify({ message: 'Ngrok URL not set yet' }),
    };
  }
};
