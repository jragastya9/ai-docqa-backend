export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    currency: 'INR',
    limits: {
      documents: 1,
      messagesPerMonth: 100,
      teamMembers: 1,
    },
    features: [
      '1 document',
      '100 AI messages/month',
      'Basic source citations',
      'Public share link',
    ],
  },
  pro: {
    name: 'Pro',
    price: 49900,
    currency: 'INR',
    limits: {
      documents: 10,
      messagesPerMonth: 5000,
      teamMembers: 5,
    },
    features: [
      '10 documents',
      '5,000 AI messages/month',
      'Advanced citations',
      'Custom branding',
      'QR code + embed widget',
      'Email support',
    ],
  },
  business: {
    name: 'Business',
    price: 199900,
    currency: 'INR',
    limits: {
      documents: -1,
      messagesPerMonth: -1,
      teamMembers: -1,
    },
    features: [
      'Unlimited documents',
      'Unlimited messages',
      'Team members + roles',
      'Custom domain',
      'API access',
      'Priority support',
    ],
  },
};

export function getPlan(planName) {
  return PLANS[planName] || PLANS.free;
}