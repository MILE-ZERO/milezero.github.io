# Mile Zero Enterprises Website

This repository contains the source for [milezeroenterprises.com](https://www.milezeroenterprises.com), the
public website for **Mile Zero Enterprises**. The site is built with plain HTML and
CSS and is served using GitHub Pages.

## Structure

- `index.html` – homepage with company overview and contact information
- `services.html` – list of consulting and engineering services
- `public/contact` – standalone contact form powered by a serverless backend
- `images/` – site assets such as the company logo

## Development

No build step is required. To preview the site locally, clone this repository and
serve the files with any static file server. For example:

```bash
python3 -m http.server
```

Then open your browser to `http://localhost:8000`.

## Deployment

The `CNAME` file configures the custom domain **milezeroenterprises.com**. Changes
pushed to the default branch are automatically published via GitHub Pages.

## Contact

For questions about Mile Zero Enterprises or this website, please email
`inquiries@milezeroenterprises.com`.

