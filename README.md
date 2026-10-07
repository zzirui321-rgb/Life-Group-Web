# LiFE Lab Website

Official website for the **LiFE Lab** (Light interaction with Free Electron Research Group).

🌐 **Website**: [https://life-group.cn](https://life-group.cn)

## Credits

| Role | Person |
| --- | --- |
| Design | Zirui Zhao（赵梓睿） |
| Development | Zirui Zhao（赵梓睿） |
| Maintenance | Zirui Zhao（赵梓睿）, Yiming Pan（潘义明） |

- **Design** — visual identity, page layout, typography and colour system, interactive research figures.
- **Development** — static site build, bilingual (Chinese / English) pages, styles and scripts.
- **Maintenance** — content updates, publications and news, deployment to GitHub Pages.

Profile: [life-group.cn/members/zirui-zhao.html](https://life-group.cn/members/zirui-zhao.html)

**AI assistance.** Parts of this website's design, code and text were created with the assistance of AI tools: ChatGPT (OpenAI), Gemini (Google) and Claude (Anthropic).

**AI 辅助声明：** 本网站的部分设计、代码与文字在 ChatGPT（OpenAI）、Gemini（Google）和 Claude（Anthropic）的辅助下完成。

## Overview

This repository hosts the static website deployment for the LiFE research group led by Prof. Yiming Pan.

- **Research Focus**: Ultrafast Electron Dynamics, Free-Electron Quantum Optics, PINEM, Nanophotonics.
- **Content**: Group members, research directions, publications, and lab activities.

## Deployment

The website is statically generated and hosted on GitHub Pages:
- **Branch**: `main`
- **Custom Domain**: `life-group.cn`
- **Routing & Assets**: Configured with `CNAME` and `.nojekyll` for static asset serving.

## Maintenance (read before editing)

**The HTML/CSS in this folder *is* the source.** The site was originally generated
with Next.js (vinext), then edited by hand (bilingual pages, news page, brand CSS).
The original Next.js source code is not in this repository, so:

- Edit the files here directly. **Do not rebuild from `site-source/`** — it only
  contains old build output and would overwrite the hand edits.
- `site-source/` is git-ignored and can be deleted locally.

### Where things live

| What | File(s) |
| --- | --- |
| Chinese pages | `index.html`, `research.html`, `publications.html`, `news.html`, `interests.html`, `members/*.html` |
| English pages | same names under `en/` (keep both languages in sync) |
| All styles (one file, organised by section, colour variables at the top) | `site.css` |
| Header, mobile menu, page index, back-to-top | `header-motion.js` |
| Heading font (Source Serif 4, OFL, self-hosted) | `fonts/` |
| Icons | `pan-life-icon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` |
| Images (use `.webp` in pages) | `images/` |

### Styles

`site.css` is the only stylesheet. It starts with a short guide, then:
1. design tokens (all colours as `--color-…` variables, fonts, radii, shadows),
2. fonts, 3. the Tailwind reset, 4+. one section per part of the site, each with
its own `@media` rules. Use the colour variables instead of new hex values, and do
not use `!important`.

### Checklist when adding content

1. Update the Chinese page and its `en/` counterpart.
2. Give every new `<img>` its real `width`/`height` attributes.
3. Update `<lastmod>` for changed pages in `sitemap.xml`.
4. Preview locally with `python -m http.server` in this folder (pages use
   root-relative paths like `/fonts/...`, so opening the files directly will not load all styles).
