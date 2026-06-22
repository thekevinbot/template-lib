import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '',
  description: '',
  base: '/template-lib/',
  cleanUrls: true,
  // AGENTS.md is an agent-facing contract, not site content — keep it out of the build.
  srcExclude: ['**/AGENTS.md'],
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Guides', link: '/guide/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Explanation', link: '/explanation/' },
      { text: 'Migrations', link: '/migrations' },
    ],
    // The sidebar groups are the four Diataxis quadrants. See docs/AGENTS.md.
    sidebar: {
      '/': [
        {
          text: 'Tutorials · learning',
          items: [
            { text: 'Getting Started', link: '/getting-started' },
          ],
        },
        {
          text: 'How-to · tasks',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Testing conventions', link: '/guide/testing-conventions' },
          ],
        },
        {
          text: 'Reference · information',
          items: [
            { text: 'API', link: '/reference/' },
            { text: 'Migrations', link: '/migrations' },
          ],
        },
        {
          text: 'Explanation · understanding',
          items: [
            { text: 'Overview', link: '/explanation/' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    outline: [2, 3],
  },
})
