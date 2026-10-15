import Tenant from '../models/Tenant.js';

export async function getPublicBranding(req, res) {
  try {
    const { subdomain, domain, slug } = req.query;

    let tenant;
    if (domain) {
      tenant = await Tenant.findOne({
        customDomain: domain.toLowerCase(),
        domainVerified: true,
      });
    } else if (subdomain) {
      tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
    } else if (slug) {
      tenant = await Tenant.findOne({ slug: slug.toLowerCase() });
    } else {
      return res
        .status(400)
        .json({ success: false, error: 'Provide subdomain, domain, or slug' });
    }

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    return res.json({
      success: true,
      branding: {
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        brandName: tenant.settings?.brandName || tenant.name,
        tagline: tenant.settings?.tagline || '',
        logo: tenant.settings?.logo || null,
        favicon: tenant.settings?.favicon || null,
        primaryColor: tenant.settings?.primaryColor || '#6366f1',
        supportEmail: tenant.settings?.supportEmail || null,
        footerText: tenant.settings?.footerText || null,
      },
    });
  } catch (err) {
    console.error('Get branding error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMyTenant(req, res) {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    return res.json({
      success: true,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        customDomain: tenant.customDomain,
        domainVerified: tenant.domainVerified,
        plan: tenant.plan,
        settings: tenant.settings || {},
      },
    });
  } catch (err) {
    console.error('Get tenant error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateBranding(req, res) {
  try {
    const {
      brandName,
      tagline,
      logo,
      favicon,
      primaryColor,
      supportEmail,
      footerText,
    } = req.body;

    const update = {};
    if (brandName !== undefined) update['settings.brandName'] = brandName || '';
    if (tagline !== undefined) update['settings.tagline'] = tagline || '';
    if (logo !== undefined) update['settings.logo'] = logo || '';
    if (favicon !== undefined) update['settings.favicon'] = favicon || '';
    if (primaryColor !== undefined) {
      if (
        primaryColor &&
        !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(primaryColor)
      ) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid color format. Use #RRGGBB' });
      }
      update['settings.primaryColor'] = primaryColor || '#6366f1';
    }
    if (supportEmail !== undefined)
      update['settings.supportEmail'] = supportEmail || '';
    if (footerText !== undefined)
      update['settings.footerText'] = footerText || '';

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      { $set: update },
      { new: true }
    );

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, error: 'Tenant not found' });
    }

    return res.json({
      success: true,
      message: 'Branding updated',
      settings: tenant.settings,
    });
  } catch (err) {
    console.error('Update branding error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateSubdomain(req, res) {
  try {
    const { subdomain } = req.body;

    if (!subdomain || typeof subdomain !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'Subdomain is required' });
    }

    const clean = subdomain.toLowerCase().trim();

    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(clean)) {
      return res.status(400).json({
        success: false,
        error:
          'Subdomain must be 3–30 chars, lowercase letters, numbers, hyphens only.',
      });
    }

    const reserved = [
      'www',
      'api',
      'app',
      'admin',
      'mail',
      'blog',
      'help',
      'docs',
    ];
    if (reserved.includes(clean)) {
      return res
        .status(400)
        .json({ success: false, error: 'This subdomain is reserved' });
    }

    const existing = await Tenant.findOne({
      subdomain: clean,
      _id: { $ne: req.tenantId },
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: 'This subdomain is already taken' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      { subdomain: clean },
      { new: true }
    );

    return res.json({
      success: true,
      message: 'Subdomain updated',
      subdomain: tenant.subdomain,
    });
  } catch (err) {
    console.error('Update subdomain error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateCustomDomain(req, res) {
  try {
    const { customDomain } = req.body;

    if (!customDomain || typeof customDomain !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'Domain is required' });
    }

    const clean = customDomain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');

    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid domain format' });
    }

    const existing = await Tenant.findOne({
      customDomain: clean,
      _id: { $ne: req.tenantId },
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: 'This domain is already in use' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      { customDomain: clean, domainVerified: false },
      { new: true }
    );

    return res.json({
      success: true,
      message: 'Domain saved. Add the DNS record to verify.',
      customDomain: tenant.customDomain,
      instructions: {
        type: 'CNAME',
        name: clean.split('.')[0],
        value: 'cname.localbizai.com',
        ttl: 3600,
      },
    });
  } catch (err) {
    console.error('Update domain error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function removeCustomDomain(req, res) {
  try {
    await Tenant.findByIdAndUpdate(req.tenantId, {
      customDomain: null,
      domainVerified: false,
    });
    return res.json({ success: true, message: 'Domain removed' });
  } catch (err) {
    console.error('Remove domain error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
