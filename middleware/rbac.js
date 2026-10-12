export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const role = req.user.role;
    if (!role) {
      return res
        .status(403)
        .json({ success: false, error: 'No role assigned to this user' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: `Requires one of: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
      });
    }
    next();
  };
}

export function requireOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  if (req.user.role !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Only the workspace owner can perform this action',
      code: 'OWNER_ONLY',
    });
  }
  next();
}
