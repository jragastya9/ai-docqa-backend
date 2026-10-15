/**
 * Lightweight user-agent parser.
 * No external dependencies — handles 95% of real-world UAs.
 */
export function parseUserAgent(ua = '') {
  const result = { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };

  if (!ua) return result;
  const s = ua.toLowerCase();

  // Browser
  if (s.includes('edg/')) result.browser = 'Edge';
  else if (s.includes('chrome') && !s.includes('edg')) result.browser = 'Chrome';
  else if (s.includes('firefox')) result.browser = 'Firefox';
  else if (s.includes('safari') && !s.includes('chrome')) result.browser = 'Safari';
  else if (s.includes('opera') || s.includes('opr/')) result.browser = 'Opera';

  // OS
  if (s.includes('windows')) result.os = 'Windows';
  else if (s.includes('mac os') || s.includes('macintosh')) result.os = 'macOS';
  else if (s.includes('android')) result.os = 'Android';
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios'))
    result.os = 'iOS';
  else if (s.includes('linux')) result.os = 'Linux';

  // Device type
  if (s.includes('mobile') || s.includes('android') || s.includes('iphone'))
    result.device = 'Mobile';
  else if (s.includes('ipad') || s.includes('tablet')) result.device = 'Tablet';
  else result.device = 'Desktop';

  return result;
}
