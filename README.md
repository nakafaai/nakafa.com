# ❤️❤️❤️❤️❤️

<p align="center">
  <img src="public/logo.svg" alt="Nakafa Logo" width="100" height="100">
</p>

<h1 align="center">Nakafa</h1>

<p align="center">
  <em>Learn for free, with quality, for everyone.</em>
</p>

<p align="center">
  <a href="https://nakafa.com"><strong>Website</strong></a> •
  <a href="https://github.com/nakafaai/nakafa.com/issues">Report Bug</a> •
  <a href="https://github.com/nakafaai/nakafa.com/discussions">Request Feature</a> •
  <a href="https://deepwiki.com/nakafaai/nakafa.com"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
  <a href="#about-the-project">About</a> •
  <a href="#key-features">Features</a> •
  <a href="#built-with">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a> •
  <a href="#contact">Contact</a>
</p>

---

## About The Project

**Nakafa** is an open-source educational platform dedicated to democratizing knowledge and making learning accessible to everyone, everywhere. Our core mission is to provide high-quality, comprehensive educational content across a wide spectrum of subjects and topics. We cater to learners of all ages and levels, from elementary school fundamentals to advanced university-level material, alongside insightful articles on current affairs and diverse topics of interest.

The name "Nakafa" (نافعة) is an Arabic word meaning "beneficial" or "useful." It embodies our commitment to creating a platform that empowers individuals through education, transcending geographical, linguistic, and socio-economic barriers.

We believe that education is a fundamental right, and Nakafa aims to be a valuable resource for self-learners, educators, and anyone passionate about acquiring knowledge.

## Project Architecture & DeepWiki

For those interested in the technical "behind-the-scenes" of Nakafa, we maintain a detailed breakdown of our project architecture, design choices, and development process on DeepWiki. This serves as a living document that provides a deeper understanding of how Nakafa is built and how its various components interact.

You can access the Nakafa DeepWiki here: <a href="https://deepwiki.com/nakafaai/nakafa.com"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

This resource is particularly useful for:

- Developers looking to contribute to the Nakafa platform.
- Individuals curious about our technology stack and architectural patterns.
- Anyone wanting a comprehensive overview of the project's technical foundations.

## Key Features

Nakafa offers a rich learning experience with features designed for accessibility and engagement:

- 🌍 **Multilingual Support**: Content is planned to be available in multiple languages.
- 📚 **Comprehensive Educational Content**: Structured learning paths covering various educational levels:
  - Elementary School
  - Middle School
  - High School
  - University Courses
- 📰 **Insightful Articles**: A curated collection of articles on diverse topics, including current events, science, technology, arts, and culture.
- 🎨 **Modern & Accessible Interface**: A clean, intuitive, and responsive design built with accessibility in mind, ensuring a seamless experience across all devices.
- 🔍 **Full-Text Search**: Powered by Pagefind, allowing users to quickly and efficiently find the exact content they need.
- 🚀 **Fast & Performant**: Built with Next.js and Turbopack for a speedy and smooth user experience.
- 🌙 **Theme Customization**: Light and dark mode support for comfortable viewing.
- 🤝 **Community-Driven**: Open to contributions for both content and platform development.

## Built With

Nakafa leverages a modern and robust technology stack to deliver a high-quality educational experience:

- **Framework**: [Next.js](https://nextjs.org/) 15 (with App Router & Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Library**: [React](https://react.dev/) 19
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) & [Radix UI](https://www.radix-ui.com/) Primitives
- **Internationalization (i18n)**: [next-intl](https://next-intl-docs.vercel.app/)
- **Content Format**: [MDX](https://mdxjs.com/)
- **Client-Side Search**: [Pagefind](https://pagefind.app/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/), [Immer](https://immerjs.github.io/immer/)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) for validation
- **Data Fetching/Caching**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Animations**: [Framer Motion](https://www.framer.com/motion/), [React Spring](https://www.react-spring.dev/)
- **Icons**: [Lucide React](https://lucide.dev/), [Tabler Icons](https://tabler-icons.io/)
- **Linting & Formatting**: [BiomeJS](https://biomejs.dev/), [ESLint](https://eslint.org/)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Ensure you have the following installed on your system:

- Node.js (v18 or higher recommended) or Bun
- Git
- A package manager: npm, Yarn, pnpm, or Bun

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/nakafaai/nakafa.git
   cd nakafa
   ```

2. **Install dependencies:**

   Choose your preferred package manager:

   ```bash
   # Using npm
   npm install

   # Using Yarn
   yarn install

   # Using pnpm
   pnpm install

   # Using Bun
   bun install
   ```

3. **Set up environment variables:**

   Copy the example environment file and customize it as needed:

   ```bash
   cp .env.example .env.local
   ```

   Fill in any necessary API keys or configuration settings in `.env.local`.

4. **Run the development server:**

   ```bash
   # Using npm
   npm run dev

   # Using Yarn
   yarn dev

   # Using pnpm
   pnpm dev

   # Using Bun
   bun dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Available Scripts

This project includes several helpful scripts (see `package.json` for a full list):

- `dev`: Starts the development server with Turbopack.
- `build`: Lints, checks, and builds the application for production.
- `start`: Starts the production server after a build.
- `lint`: Runs linter checks using Next.js lint and Biome.
- `lint:fix`: Automatically fixes linting and formatting issues.
- `format`: Checks formatting with Biome.
- `format:fix`: Fixes formatting issues with Biome.
- `type-check`: Runs TypeScript compiler to check for type errors.
- `postbuild`: Generates search index using Pagefind.

### Build for Production

To build the application for production and start the server:

```bash
# Using npm
npm run build
npm run start

# Using Yarn
yarn build
yarn start

# Using pnpm
pnpm build
pnpm start

# Using Bun
bun run build
bun run start
```

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**!

We welcome contributions in various forms:

- Reporting bugs and issues
- Suggesting new features or enhancements
- Improving documentation
- Adding or translating educational content
- Developing new platform features

### How to Contribute Code

1. **Fork the Project:** Click the "Fork" button at the top right of this page.
2. **Create your Feature Branch:**

   ```bash
   git checkout -b feature/AmazingFeature
   ```

   Or for bug fixes:

   ```bash
   git checkout -b fix/SomeBug
   ```

3. **Make your Changes:** Implement your feature or bug fix.
4. **Commit your Changes:** Write clear, concise commit messages.

   ```bash
   git commit -m 'Add some AmazingFeature'
   ```

5. **Lint and Test your Changes:**

   ```bash
   npm run lint:fix
   npm run type-check
   # Add tests if applicable and run them
   ```

6. **Push to the Branch:**

   ```bash
   git push origin feature/AmazingFeature
   ```

7. **Open a Pull Request:** Go to the Nakafa GitHub repository and open a new Pull Request from your forked branch.
   Please provide a clear description of the changes and any relevant issue numbers.

### Content Contributions

If you're passionate about education and want to contribute content:

- **For Developers:** You can add content directly by creating MDX files in the appropriate `contents/` subdirectories. Follow the coding contribution process outlined above.
- **For Non-Developers/Educators:** We'd love to hear from you! Please email your content suggestions, drafts, or completed materials to <nakafaai@gmail.com> with:
  - **Subject:** `[Content Submission] - <Brief Title of Content>`
  - Your name or preferred handle for attribution.
  - The content itself (e.g., as a document, MDX, or plain text).
  - Any relevant sources or references.

### Contribution Guidelines

To ensure a smooth collaboration process, please:

- Adhere to the project's coding style and conventions (enforced by Biome and ESLint).
- Write clear, descriptive commit messages and Pull Request titles.
- Ensure your code is well-documented, especially for complex logic.
- Update existing documentation if your changes affect it.
- Be respectful and constructive in all communications.
- Consider opening an issue to discuss significant changes before starting work.

## License

Nakafa is distributed under a dual-license model:

1. **GNU Affero General Public License v3.0 (AGPL-3.0):**
   The project is freely available under the [AGPL-3.0 license](./LICENSE). This license permits use, modification, and distribution (including for non-commercial and commercial purposes), provided that all modifications and distributions are also licensed under AGPL-3.0 and the complete corresponding source code is made available.

2. **Commercial License:**
   For uses that do not comply with the AGPL-3.0 terms (e.g., inclusion in proprietary/closed-source commercial products without releasing the source code, or if you require different terms and conditions), a separate commercial license must be obtained.

Please contact us at <nakafaai@gmail.com> for inquiries regarding commercial licensing.

This dual-licensing model ensures that Nakafa remains free and open-source for the community while providing a path for commercial applications that may not align with the copyleft provisions of the AGPL-3.0.

## Contact

Nabil Fatih - [@nabilfatih](https://twitter.com/nabilfatih_) - <nakafaai@gmail.com>

Project Link: [https://github.com/nakafaai/nakafa.com](https://github.com/nakafaai/nakafa.com)

---

<p align="center">Built with ❤️ for learners everywhere.</p>
<p align="center">© 2024 Nakafa. All rights reserved (unless otherwise stated under the AGPL-3.0 license).</p>
