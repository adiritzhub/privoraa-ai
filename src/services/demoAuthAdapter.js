function createDemoUser({ email, name = '' }) {
  const displayName = name.trim() || email.split('@')[0] || 'Learner'
  return {
    id: 'demo-user',
    email,
    displayName,
    role: 'user',
    permissionState: 'normal',
  }
}

export const demoAuthAdapter = {
  mode: 'demo',

  async signIn({ email }) {
    return createDemoUser({ email })
  },

  async register({ email, name }) {
    return createDemoUser({ email, name })
  },

  async startFounderPreview() {
    return {
      id: 'demo-founder',
      email: 'founder-preview@example.test',
      displayName: 'Founder preview',
      role: 'founder',
      permissionState: 'normal',
    }
  },

  async signOut() {},
}