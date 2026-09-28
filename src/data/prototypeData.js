export const prototypeApprovals = [
  {
    id: 'review-1042',
    name: 'Mira Chen',
    category: 'Learning illustration',
    classification: 'restricted',
    submittedAt: 'Today, 9:42 AM',
    prompt: 'A paper-cutaway illustration of the water cycle over a mountain valley, with clear classroom labels.',
    status: 'pending',
  },
  {
    id: 'review-1041',
    name: 'Jonah Ellis',
    category: 'Historical scene',
    classification: 'restricted',
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
    role: 'user',
    permissionState: 'normal',
  },
  {
    id: 'user-02',
    name: 'Jonah Ellis',
    email: 'jonah@example.test',
    role: 'user',
    permissionState: 'restricted',
  },
  {
    id: 'user-03',
    name: 'Alex Rivera',
    email: 'alex@example.test',
    role: 'user',
    permissionState: 'suspended',
  },
  { id: 'user-04', name: 'Founder Preview', email: 'founder@example.test', role: 'founder', permissionState: 'normal' },
]

export const prototypeCategories = ['Learning illustration', 'Historical scene', 'Product study']

export const prototypeActivity = [
  { id: 'event-01', action: 'Sample approval reviewed', detail: 'Learning illustration request marked approved in preview.', actor: 'Founder Preview', time: 'Today, 10:06 AM' },
  { id: 'event-02', action: 'Permission state changed', detail: 'Example account set to restricted.', actor: 'Founder Preview', time: 'Today, 9:31 AM' },
  { id: 'event-03', action: 'Generation paused', detail: 'Global generation switch is off in preview settings.', actor: 'System preview', time: 'Today, 9:14 AM' },
]