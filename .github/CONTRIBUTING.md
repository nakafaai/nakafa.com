# 🌟 Contributing to nakafa.com

> 🎓 **Building the future of education together!** Welcome to our vibrant community of learners, educators, and developers.

Thank you for your interest in contributing to nakafa! Every contribution, no matter how small, helps millions of learners access better educational content. Together, we're making education more accessible, engaging, and effective for everyone! 🚀

## 🤔 New to Contributing?

**No worries!** Everyone starts somewhere, and we're here to help you succeed:

- 💬 **Questions?** Join our [Discord community](https://discord.gg/CPCSfKhvfQ) or start a [GitHub Discussion](https://github.com/nakafaai/nakafa.com/discussions)
- 🐛 **Found a bug?** Use our [Bug Report template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=🐛+bug,🔍+needs-triage&template=bug_report.yml&title=🐛+[BUG]+)
- 💡 **Have an idea?** Share it via our [Feature Request template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=✨+enhancement,💭+idea,🔍+needs-triage&template=feature_request.yml&title=✨+[FEAT]+)
- 📚 **Want to suggest content?** Use our [Content Suggestion template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=📚+content,💡+suggestion,🎓+education,🔍+needs-triage&template=content-suggestion.yml&title=📚+[CONTENT]+)

## 🎯 Ways to Contribute

### 🐛 **Bug Reports & Fixes**

Help us squash bugs and improve user experience! Use our [Bug Report template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=🐛+bug,🔍+needs-triage&template=bug_report.yml&title=🐛+[BUG]+) to report issues.

### ✨ **Feature Development**

Got ideas to make nakafa even better? Share them via our [Feature Request template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=✨+enhancement,💭+idea,🔍+needs-triage&template=feature_request.yml&title=✨+[FEAT]+)!

### 📚 **Educational Content**

- **Subject matter experts**: Help create and review educational content
- **Educators**: Share teaching insights and content suggestions
- **Students**: Provide feedback on learning materials and suggest improvements
- Use our [Content Suggestion template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=📚+content,💡+suggestion,🎓+education,🔍+needs-triage&template=content-suggestion.yml&title=📚+[CONTENT]+) to propose new educational content

### 📖 **Documentation**

Help make our docs clearer and more helpful! Use our [Documentation template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=📖+documentation,✨+enhancement,🔍+needs-triage&template=documentation.yml&title=📖+[DOCS]+) to suggest improvements.

### 🌍 **Internationalization**

- Translate content to Indonesian and other languages
- Improve localization and cultural adaptations
- Help make education accessible globally

### ⚡ **Performance & Accessibility**

Make nakafa faster and more accessible! Use our [Performance & Accessibility template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=⚡+performance,♿+accessibility,🎨+UX,🔍+needs-triage&template=performance-accessibility.yml&title=⚡+[PERF/A11Y]+) to report issues.

### 🎨 **Design & User Experience**

- Improve UI/UX design
- Create educational visualizations and graphics
- Enhance mobile experience

## 🛠️ Development Setup

### 📋 Prerequisites

- **Node.js**: Version 18+
- **pnpm**: We use pnpm as our package manager
- **Git**: For version control

### ⚡ Quick Start

1. **🍴 Fork & Clone**

   ```bash
   git clone https://github.com/YOUR-USERNAME/nakafa.com.git
   cd nakafa.com
   ```

2. **📦 Install Dependencies**

   ```bash
   pnpm install
   ```

3. **🚀 Start Development Server**

   ```bash
   cd apps/www
   pnpm dev
   ```

4. **🌐 Open in Browser**
   Visit `http://localhost:3000` to see nakafa running locally!

### 🏗️ Project Structure

```
nakafa/
├── 📱 apps/www/              # Main Next.js application
├── 📦 packages/
│   ├── 📚 contents/          # Educational content & MDX files
│   ├── 🎨 design-system/    # UI components & design tokens
│   ├── 🌍 internationalization/ # i18n configuration
│   ├── 📊 analytics/        # Analytics utilities
│   └── 🔧 ...              # Other shared packages
```

### 🧪 Testing & Quality

```bash
# Run tests
pnpm test

# Run linter
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check
```

## 📝 Pull Request Process

### 🚀 Ready to Submit?

1. **🔍 Check Your Work**
   - All tests pass: `pnpm test`
   - No linting errors: `pnpm lint`
   - TypeScript compiles: `pnpm type-check`
   - Tested on mobile and desktop

2. **📝 Create Pull Request**
   - Use our [PR template](.github/PULL_REQUEST_TEMPLATE.md) (auto-filled)
   - Link related issues with `Closes #123`
   - Include screenshots for UI changes
   - Write clear, descriptive commit messages

3. **🎉 Review Process**
   - A maintainer will review your PR
   - Address any feedback promptly
   - Once approved, we'll merge it!

## 🎨 Code Style Guidelines

### 💻 **TypeScript & React**

- Use functional components with hooks
- Write TypeScript with strict mode enabled
- Export components and utilities with named exports
- Follow Next.js App Router conventions

### 🎯 **Educational Content**

- Use MDX for rich educational content
- Include proper learning objectives
- Ensure accessibility (WCAG 2.1 AA)
- Test mathematical notation with screen readers

### 🌍 **Internationalization**

- All user-facing strings must be translatable
- Use semantic translation keys
- Support both English and Indonesian
- Consider RTL languages for future expansion

### 🎨 **Design System**

- Use components from `packages/design-system`
- Follow established color and spacing systems
- Ensure mobile-first responsive design
- Maintain consistent visual hierarchy

## 📚 Content Contribution Guidelines

### 🎓 **Creating Educational Content**

1. **📋 Plan Your Content**
   - Define clear learning objectives
   - Identify target grade level and prerequisites
   - Consider different learning styles

2. **✍️ Write in MDX**
   - Use interactive components from our design system
   - Include proper mathematical notation with KaTeX
   - Add 3D visualizations where helpful

3. **♿ Accessibility First**
   - Provide alt text for all images and diagrams
   - Use semantic HTML structure
   - Test with screen readers
   - Ensure proper color contrast

4. **🔍 Review Process**
   - Content reviewed by subject matter experts
   - Tested with actual students when possible
   - Aligned with curriculum standards

## 🤝 Community Guidelines

### 💫 **Our Values**

- **🎓 Educational Excellence**: Quality content that truly helps learners
- **🌍 Inclusivity**: Welcome everyone regardless of background or skill level
- **🤝 Collaboration**: Work together to build something amazing
- **💡 Innovation**: Embrace new ideas and creative solutions
- **♿ Accessibility**: Ensure education is available to everyone

### 🗣️ **Communication**

- **Be Kind**: Treat everyone with respect and empathy
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that contributors have different experience levels
- **Be Inclusive**: Use welcoming and inclusive language

## 🆘 Need Help?

### 💬 **Get Support**

- 🎮 **Discord**: Join our [community chat](https://discord.gg/CPCSfKhvfQ) for quick help
- 💭 **Discussions**: Use [GitHub Discussions](https://github.com/nakafaai/nakafa.com/discussions) for longer conversations
- ❓ **Questions**: Use our [Question template](https://github.com/nakafaai/nakafa.com/issues/new?assignees=&labels=❓+question,🆘+help-wanted,🔍+needs-triage&template=question.yml&title=❓+[QUESTION]+) for specific questions

### 🏷️ **Issue Labels**

- 🆕 `good first issue` - Perfect for newcomers
- 🆘 `help wanted` - We'd love community help on this
- 🎓 `education` - Related to educational content
- 🎨 `design` - UI/UX improvements
- 🌍 `i18n` - Internationalization work
- ♿ `accessibility` - Accessibility improvements

## 🛡️ **Security**

Found a security vulnerability? Please report it privately through our [Security Advisory](https://github.com/nakafaai/nakafa.com/security/advisories/new) - don't open a public issue.

## 🎉 Recognition

We appreciate all our contributors! Your contributions will be:

- 📜 Listed in our contributors page
- 🎖️ Credited in release notes for significant contributions
- 💫 Celebrated in our Discord community
- 📈 Contributing to your GitHub profile and portfolio

---

## 🚀 Ready to Start?

1. 👋 Introduce yourself in our [Discord](https://discord.gg/CPCSfKhvfQ)
2. 🔍 Browse [`good first issue`](https://github.com/nakafaai/nakafa.com/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) tagged issues
3. 💬 Ask questions in [Discussions](https://github.com/nakafaai/nakafa.com/discussions)
4. 🛠️ Set up your development environment
5. 🎉 Make your first contribution!

**Every contribution matters!** Whether you're fixing a typo, adding a feature, or creating educational content, you're helping build a better future for education. Thank you for being part of our community! 💖

---

> 🌟 **"Education is the most powerful weapon which you can use to change the world."** - Nelson Mandela
>
> Together, we're building tools that empower millions of learners worldwide. Thank you for contributing to this mission! 🚀
