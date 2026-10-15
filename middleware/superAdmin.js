/**
 * Super admin guard.
 * Only allows access if the authenticated user's email is in SUPER_ADMIN_EMAILS.
 */
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function superAdminOnly(req, res, next) {
  if (!req.user?.email) {
    return res
      .status(401)
      .json({ success: false, error: 'Not authenticated' });
  }

  const userEmail = req.user.email.toLowerCase();
  if (!SUPER_ADMIN_EMAILS.includes(userEmail)) {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
      code: 'NOT_SUPER_ADMIN',
    });
  }

  next();
}

export function isSuperAdmin(email) {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
