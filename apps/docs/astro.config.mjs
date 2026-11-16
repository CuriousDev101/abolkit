import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

/** Public docs for Abol Kit. Install snippets pin npm/CDN to @0.1.1. */
export default defineConfig({
  site: 'https://abolkit.local',
  integrations: [
    starlight({
      title: 'Abol Kit',
      description:
        'Accessible learning-media toolkit: <abol-player>, <abol-job-card>, and install guides for @0.1.1.',
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/CuriousDev101/abolkit',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/CuriousDev101/abolkit/edit/main/apps/docs/',
      },
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Overview', slug: 'index' },
            { label: 'Quickstart', slug: 'getting-started' },
          ],
        },
        {
          label: 'Install @0.1.1',
          items: [
            { label: 'Install overview', slug: 'install' },
            { label: 'CDN (script tag)', slug: 'install/cdn' },
            { label: '@abolkit/player', slug: 'install/player' },
            { label: '@abolkit/job-card', slug: 'install/job-card' },
            { label: 'Frameworks', slug: 'install/frameworks' },
          ],
        },
        {
          label: 'Components',
          items: [
            { label: '<abol-player>', slug: 'components/player' },
            { label: '<abol-job-card>', slug: 'components/job-card' },
          ],
        },
        {
          label: 'Guides',
          items: [{ label: 'Accessibility', slug: 'guides/accessibility' }],
        },
      ],
      lastUpdated: true,
      pagination: true,
    }),
  ],
})
