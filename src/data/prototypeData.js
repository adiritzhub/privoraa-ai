export const prototypeApprovals = [
  {
    id: 'review-1042',
    name: 'Mira Chen',
    category: 'Learning illustration',
    submittedAt: 'Today, 9:42 AM',
    prompt: 'A paper-cutaway illustration of the water cycle over a mountain valley, with clear classroom labels.',
    status: 'pending',
  },
  {
    id: 'review-1041',
    name: 'Jonah Ellis',
    category: 'Historical scene',
    submittedAt: 'Today, 8:16 AM',
    prompt: 'An educational, museum-style reconstruction of an ancient Roman street at midday.',
    status: 'pending',
  },
]

export const prototypeUsers = [
  {
    id: 'user-01',
    name: 'Mira Chen',
    email: 'mira@example.test',
    role: 'member',
    status: 'active',
    permissions: { generate: true, submitForReview: true },
  },
  {
    id: 'user-02',
    name: 'Jonah Ellis',
    email: 'jonah@example.test',
    role: 'educator',
    status: 'active',
    permissions: { generate: true, submitForReview: true },
  },
  {
    id: 'user-03',
    name: 'Alex Rivera',
    email: 'alex@example.test',
    role: 'member',
    status: 'paused',
    permissions: { generate: false, submitForReview: true },
  },
]

export const prototypeCategories = ['Learning illustration', 'Historical scene', 'Product study']