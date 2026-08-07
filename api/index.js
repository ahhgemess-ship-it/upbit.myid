// Entry serverless Vercel — dynamic import untuk kompatibilitas ESM→CJS
export default async function handler(req, res) {
  const { default: app } = await import('../server/src/index.js');
  // Express app sebagai Vercel serverless handler
  return new Promise((resolve, reject) => {
    app(req, res);
    res.on('finish', () => resolve());
    res.on('error', reject);
  });
}
