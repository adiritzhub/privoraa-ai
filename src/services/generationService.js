export const generationService = {
  getStatus({ permissionState, generationEnabled }) {
    if (permissionState === 'restricted') {
      return {
        state: 'restricted',
        message: 'This account is restricted. The backend must classify requests and require review as appropriate. This prompt was not sent, classified, or queued.',
      }
    }

    if (!generationEnabled) {
      return {
        state: 'paused',
        message: 'Global generation is disabled in preview settings. This prompt was not sent, classified, or generated.',
      }
    }

    return {
      state: 'unavailable',
      connected: false,
      message: 'AI model and policy services are not connected yet. This prompt was not sent, classified, queued, or generated.',
    }
  },
}