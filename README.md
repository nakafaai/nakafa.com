<!-- Nakafa: Learn for free and with quality -->

<div align="center" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 40px 20px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
  <img src="public/logo.svg" alt="Nakafa Logo" width="120" height="120" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); border: 4px solid #4a5568; border-radius: 50%; padding: 8px; background-color: rgba(255,255,255,0.8);">
  
  <h1 style="margin: 20px 0 10px; color: #2d3748; font-size: 3.5rem; font-weight: 700; letter-spacing: -1px;">Nakafa</h1>
  
  <p style="color: #4a5568; font-size: 1.2rem; margin-bottom: 25px; font-style: italic;">Learn for free and with quality</p>
  
  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin: 20px 0;">
    <a href="#about" style="text-decoration: none; color: #4a5568; font-weight: 500; background-color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 20px; transition: all 0.3s ease;">About</a>
    <a href="#features" style="text-decoration: none; color: #4a5568; font-weight: 500; background-color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 20px; transition: all 0.3s ease;">Features</a>
    <a href="#tech-stack" style="text-decoration: none; color: #4a5568; font-weight: 500; background-color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 20px; transition: all 0.3s ease;">Tech Stack</a>
    <a href="#getting-started" style="text-decoration: none; color: #4a5568; font-weight: 500; background-color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 20px; transition: all 0.3s ease;">Getting Started</a>
    <a href="#contributing" style="text-decoration: none; color: #4a5568; font-weight: 500; background-color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 20px; transition: all 0.3s ease;">Contributing</a>
    <a href="#license" style="text-decoration: none; color: #4a5568; font-weight: 500; background-color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 20px; transition: all 0.3s ease;">License</a>
  </div>
</div>

---

## About

Nakafa is an open-source educational platform designed to democratize knowledge and make learning accessible to everyone. Our mission is to provide high-quality educational content across various subjects and topics, from elementary school to university level, as well as articles on current affairs.

The name "Nakafa" represents our commitment to creating a platform where people can learn for free and with quality that transcends geographical, linguistic, and socioeconomic barriers to education.

## Features

- **Multilingual Support**: Content available in multiple languages
- **Educational Content**: Organized by educational levels (Elementary, Junior High, Senior High, University)
- **Articles**: Curated articles on various topics including politics, etc.
- **Modern Interface**: Clean, accessible, and responsive design
- **Full-Text Search**: Easily find the content you need

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS
- **Components**: Radix UI primitives
- **Languages**: TypeScript
- **Internationalization**: next-intl
- **Content**: MDX
- **Search**: Pagefind

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Git
- Package manager (npm, Yarn, pnpm, or Bun)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/nakafa.git
   cd nakafa
   ```

2. Install dependencies:

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

3. Run the development server:

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

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Environment Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Update the environment variables as needed.

### Build for Production

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

We welcome contributions from everyone! Here's how you can help:

### Code Contributions

1. Fork the repository
2. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes
4. Run tests and linting:

   ```bash
   npm run lint
   npm run type-check
   ```

5. Commit your changes:

   ```bash
   git commit -m "Add feature: your feature description"
   ```

6. Push to your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

7. Open a Pull Request

### Content Contributions

You can contribute educational content or articles in the following ways:

- **For developers**: Follow the code contribution process above and add content using MDX in the appropriate directories.
- **For non-developers**: Email your content suggestions or submissions to <nakafaai@gmail.com> with:
  - Subject line: "[Content Submission] - Brief Title"
  - Your name/handle for attribution
  - The content you'd like to contribute
  - Any references or sources

### Contribution Guidelines

- Follow the code style of the project
- Write clear, concise commit messages
- Add tests when applicable
- Update documentation for significant changes
- Respect the code of conduct

## License

Nakafa is an open-source project available under a custom license with the following terms:

- ✅ **Allowed**:

  - Fork the repository
  - Self-host the platform
  - Modify the code for personal or educational use
  - Contribute to the original project
  - Use the platform for learning and teaching

- ❌ **Not Allowed**:
  - Commercialize the project in any way
  - Sell access to instances of the platform
  - Use the codebase to create a commercial product
  - Monetize the platform through subscriptions, ads, or paywalls

This license is designed to ensure that Nakafa remains free and accessible to everyone. The project can be forked, modified, and self-hosted, but it must not be used to generate income. Any derivative work must maintain these same license restrictions.

For questions regarding the license or special use cases, please contact us at <nakafaai@gmail.com>.

---

<div align="center" style="margin-top: 50px; padding: 30px 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 10px; box-shadow: 0 -4px 10px rgba(0,0,0,0.03);">
  <p style="margin: 0; font-size: 1.1rem; color: #4a5568;">
    Built with <span style="color: #e53e3e; font-size: 1.3rem;">❤️</span> for learners everywhere
  </p>
  <p style="color: #718096; font-size: 0.9rem; margin-top: 10px;">
    © 2024 Nakafa
  </p>
</div>
