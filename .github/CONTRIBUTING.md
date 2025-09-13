# Contributing to Markdown Table Editor

Thank you for your interest in contributing to the Markdown Table Editor extension! This document provides guidelines for contributing to the project.

## Changelog Management

### When to Update the Changelog

Please update the `CHANGELOG.md` file whenever you make changes that affect:

- **Features**: New functionality or enhancements
- **Bug Fixes**: Resolved issues or problems
- **Breaking Changes**: Changes that might affect existing workflows
- **Performance Improvements**: Optimizations and performance enhancements
- **UI/UX Changes**: Interface improvements or visual changes
- **Technical Improvements**: Code refactoring, architecture changes, or development workflow improvements

### How to Update the Changelog

1. **Location**: All release notes should be added to `CHANGELOG.md` only. Do not duplicate changelog entries in `README.md`.

2. **Format**: Follow the existing format in `CHANGELOG.md`:
   ```markdown
   ## [Version] - YYYY-MM-DD

   ### Added
   - New features or functionality

   ### Enhanced
   - Improvements to existing features

   ### Fixed
   - Bug fixes and issue resolutions

   ### Changed
   - Changes to existing functionality

   ### Removed
   - Removed features or functionality

   ### Technical Improvements
   - Code refactoring, architecture changes, etc.
   ```

3. **Version Numbers**: Use semantic versioning (MAJOR.MINOR.PATCH)
   - **MAJOR**: Breaking changes
   - **MINOR**: New features (backwards compatible)
   - **PATCH**: Bug fixes (backwards compatible)

4. **Order**: Add new entries at the top of the changelog, after the main heading

5. **Categories**: Use appropriate categories (Added, Enhanced, Fixed, Changed, Removed, Technical Improvements)

6. **Details**: Provide clear, concise descriptions of changes that help users understand the impact

### Example Entry

```markdown
## [0.5.4] - 2025-09-01

### Added
- **New Feature**: Description of the new feature and its benefits

### Enhanced
- **Existing Feature**: Description of the improvement and its impact

### Fixed
- **Bug Description**: Clear explanation of what was fixed and why it matters

### Technical Improvements
- **Code Architecture**: Description of internal improvements that don't directly affect users
```

## Development Workflow

1. **Before Making Changes**
   - Check if similar changes are already documented in the changelog
   - Understand the current version numbering scheme

2. **During Development**
   - Keep track of all changes that would be user-facing
   - Note any breaking changes or migration requirements

3. **Before Submitting PR**
   - Update `CHANGELOG.md` with your changes
   - Ensure the changelog entry is clear and comprehensive
   - Verify the version number follows semantic versioning
   - Do not modify release notes in `README.md`

## Release Notes vs Changelog

- **CHANGELOG.md**: Complete, detailed history of all changes (primary source)
- **README.md**: Should only contain basic feature descriptions and current functionality
- **Release Notes**: Generated from CHANGELOG.md for VS Code Marketplace

## Questions?

If you're unsure about how to categorize your changes or which version number to use, feel free to ask in your pull request. We're happy to help ensure the changelog remains clear and useful for all users.

Thank you for helping maintain clear project documentation!
