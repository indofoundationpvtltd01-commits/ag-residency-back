const express = require('express');
const router = express.Router();

// 301 Moved Permanently redirect to the authoritative client sitemap
router.get('/sitemap.xml', (req, res) => {
  const targetSitemap = process.env.CLIENT_URL || 'https://www.agresidency.in';
  const unifiedSitemapUrl = `${targetSitemap.replace(/\/+$/, '')}/sitemap.xml`;
  
  res.redirect(301, unifiedSitemapUrl);
});

module.exports = router;
