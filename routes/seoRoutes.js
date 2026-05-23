const express = require('express');
const Hotel = require('../models/Hotel');
const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.CLIENT_URL || 'https://www.agrooms.in';
    const hotels = await Hotel.find({ isActive: true }).select('slug updatedAt createdAt');

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Static Routes
    const staticRoutes = [
      { url: '/', priority: 1.0, changefreq: 'daily' },
      { url: '/search', priority: 0.9, changefreq: 'daily' },
      { url: '/about', priority: 0.8, changefreq: 'monthly' },
      { url: '/contact', priority: 0.8, changefreq: 'monthly' },
      { url: '/location/sriperumbudur', priority: 0.8, changefreq: 'weekly' },
      { url: '/location/hogenakkal', priority: 0.8, changefreq: 'weekly' },
      // Programmatic SEO Landing Pages
      { url: '/budget-hotels-in-sriperumbudur', priority: 0.8, changefreq: 'weekly' },
      { url: '/hotels-near-sipcot', priority: 0.8, changefreq: 'weekly' },
      { url: '/family-rooms-hogenakkal', priority: 0.8, changefreq: 'weekly' },
      { url: '/ac-rooms-in-sriperumbudur', priority: 0.8, changefreq: 'weekly' },
      { url: '/hotels-near-industrial-area', priority: 0.8, changefreq: 'weekly' }
    ];

    const today = new Date().toISOString().split('T')[0];

    staticRoutes.forEach(route => {
      sitemap += `
  <url>
    <loc>${baseUrl}${route.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    });

    // Dynamic Hotel Routes
    hotels.forEach(hotel => {
      const lastMod = hotel.updatedAt ? hotel.updatedAt.toISOString().split('T')[0] : (hotel.createdAt ? hotel.createdAt.toISOString().split('T')[0] : today);
      sitemap += `
  <url>
    <loc>${baseUrl}/hotel/${hotel.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    sitemap += `
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Sitemap Generation Error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
