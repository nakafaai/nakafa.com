# Project Structure

This is a Next.js project using the App Router.

## Key Directories

- `app/`: Contains the main application routes and UI components. (@app/)
- `components/`: Shared UI components used across the application. (@components/)
- `lib/`: Utility functions and shared logic. (@lib/)
- `contents/`: Stores MDX content files. (@contents/)
- `public/`: Static assets like images and fonts. (@public/)
- `styles/`: Global stylesheets. (@styles/)
- `i18n/`: Internationalization configuration and locale files. (@i18n/)

## Key Configuration Files

- `next.config.ts`: Next.js configuration. (@next.config.ts)
- `tailwind.config.ts`: Tailwind CSS configuration. (@tailwind.config.ts)
- `tsconfig.json`: TypeScript configuration. (@tsconfig.json)
- `package.json`: Project dependencies and scripts. (@package.json)
- `components.json`: Configuration for shadcn/ui components. (@components.json)

## Content & Styling

- Content is primarily written in MDX format within the `contents/` directory.
- Custom MDX components are defined in `mdx-components.tsx`. (@mdx-components.tsx)
- Styling is primarily handled by Tailwind CSS and potentially CSS modules or styled components within the `components/` and `app/` directories. Global styles are in `styles/globals.css`. (@styles/globals.css)
