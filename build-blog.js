const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const prettier = require("prettier");
const MarkdownIt = require("markdown-it");
const Shiki = require("@shikijs/markdown-it");
const anchor = require("markdown-it-anchor");

const USERNAME = "ShashwatAgrawal20";
const REPO = "portfolio";
const POST_LABEL = "blog-post";
const SITE_ORIGIN = "https://shashwatagrawal20.github.io/portfolio";
const OG_IMAGE = `${SITE_ORIGIN}/assets/og/og_image.png`;
const POSTS_DIR = path.join(__dirname, "posts");
const JSON_PATH = path.join(__dirname, "blog-posts.json");

let mdRenderer = null;

function extractExcerpt(body) {
    const intro = (body || "").split(/##\s*table of contents/i)[0];
    const MAX = 300;
    let cleaned = intro
        .replace(/^>\s?/gm, "")
        .replace(/^#+\s?/gm, "")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/`{1,3}[^`]+`{1,3}/g, "")
        .trim();
    cleaned = cleaned.replace(/\s+/g, " ");
    if (cleaned.length > MAX) cleaned = cleaned.slice(0, MAX).trim() + "…";
    return cleaned;
}

async function getMarkdownRenderer() {
    if (mdRenderer) return mdRenderer;

    const md = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true,
    });

    md.use(anchor, {
        slugify: (s) =>
            s
                .toLowerCase()
                .trim()
                .replace(/[^\w]+/g, "-")
                .replace(/^-+|-+$/g, ""),
    });

    md.use(
        await Shiki.default({
            theme: "github-dark-default",
        })
    );

    const originalFence = md.renderer.rules.fence;
    md.renderer.rules.fence = function (...args) {
        const html = originalFence(...args);

        return `
            <div class="code-wrapper">
                ${html}
                <button class="copy-btn">Copy</button>
            </div>
        `;
    };

    mdRenderer = md;
    return mdRenderer;
}

function getAuthHeaders() {
    if (!process.env.GITHUB_TOKEN) {
        console.warn("GITHUB_TOKEN is not set. API requests may be rate-limited.");
    }
    return {
        Authorization: process.env.GITHUB_TOKEN
            ? `token ${process.env.GITHUB_TOKEN}`
            : "",
        "User-Agent": "blog-builder",
    };
}

async function fetchBlogPosts() {
    console.log("Fetching all blog posts...");
    const url = `https://api.github.com/repos/${USERNAME}/${REPO}/issues?labels=${POST_LABEL}&state=open&sort=created&direction=desc&per_page=100`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
    const posts = await response.json();
    console.log(`Found ${posts.length} posts`);
    return posts;
}

async function fetchSinglePost(issueNumber) {
    console.log(`Fetching single post: #${issueNumber}`);
    const url = `https://api.github.com/repos/${USERNAME}/${REPO}/issues/${issueNumber}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
    return await response.json();
}

function generateSlug(title) {
    return (title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function filenameFor(post) {
    // Public URL is slug-only; issue number stays in JSON for identity.
    return `${generateSlug(post.title)}.html`;
}

function toMeta(post) {
    const slug = generateSlug(post.title);
    const filename = filenameFor(post);
    return {
        issueNumber: post.number,
        title: post.title,
        slug,
        date: post.created_at,
        url: `posts/${filename}`,
        githubUrl: post.html_url,
        excerpt: extractExcerpt(post.body),
    };
}

function isBlogPost(post) {
    return (
        post.state === "open" &&
        Array.isArray(post.labels) &&
        post.labels.some((label) => label.name === POST_LABEL)
    );
}

function loadExistingPostsList() {
    if (!fs.existsSync(JSON_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    } catch {
        return [];
    }
}

function removePostFilesForIssue(issueNumber) {
    if (!fs.existsSync(POSTS_DIR)) return;

    // Resolve current path(s) via seeded blog-posts.json (issueNumber → url).
    for (const entry of loadExistingPostsList()) {
        if (entry.issueNumber !== issueNumber) continue;
        const file = entry.url
            ? path.basename(entry.url)
            : entry.slug
              ? `${entry.slug}.html`
              : null;
        if (!file) continue;
        const filepath = path.join(POSTS_DIR, file);
        if (fs.existsSync(filepath)) {
            console.log(`Removing: ${file}`);
            fs.unlinkSync(filepath);
        }
    }

    // Clean leftover files from the old `{issueNumber}-{slug}.html` scheme.
    const prefix = `${issueNumber}-`;
    for (const file of fs.readdirSync(POSTS_DIR)) {
        if (file.startsWith(prefix) && file.endsWith(".html")) {
            console.log(`Removing legacy: ${file}`);
            fs.unlinkSync(path.join(POSTS_DIR, file));
        }
    }
}

function pruneOrphanHtml(postsList) {
    if (!fs.existsSync(POSTS_DIR)) return;
    const keep = new Set(postsList.map((p) => path.basename(p.url)));
    for (const file of fs.readdirSync(POSTS_DIR)) {
        if (!file.endsWith(".html")) continue;
        if (!keep.has(file)) {
            console.log(`Pruning orphan: ${file}`);
            fs.unlinkSync(path.join(POSTS_DIR, file));
        }
    }
}

async function writePost(post) {
    // Drop prior HTML for this issue (covers title/slug renames).
    removePostFilesForIssue(post.number);

    const filename = filenameFor(post);
    const filepath = path.join(POSTS_DIR, filename);

    console.log(`Generating: ${filename}`);
    const rawHtml = await generatePostHTML(post);
    const lazyimgHtml = rawHtml.replace(
        /<img(?![^>]*loading=)/g,
        '<img loading="lazy" decoding="async"'
    );
    const formattedHtml = await prettier.format(lazyimgHtml, {
        parser: "html",
        tabWidth: 4,
    });

    fs.mkdirSync(POSTS_DIR, { recursive: true });
    fs.writeFileSync(filepath, formattedHtml);

    return toMeta(post);
}

async function writeBlogJson(postsList) {
    console.log("Generating blog-posts.json...");
    postsList.sort((a, b) => new Date(b.date) - new Date(a.date));

    const rawJson = JSON.stringify(postsList, null, 2);
    const formattedJson = await prettier.format(rawJson, {
        parser: "json",
        tabWidth: 4,
    });
    fs.writeFileSync(JSON_PATH, formattedJson);
}

/** Rebuild JSON from API; generate any missing HTML (cheap recovery). */
async function syncIndexFromApi(options = {}) {
    const { renderMissing = true } = options;
    const posts = await fetchBlogPosts();
    const postsList = [];

    for (const post of posts) {
        const meta = toMeta(post);
        postsList.push(meta);

        const filepath = path.join(POSTS_DIR, filenameFor(post));
        if (renderMissing && !fs.existsSync(filepath)) {
            console.log(`Missing HTML for #${post.number}, generating...`);
            await writePost(post);
        }
    }

    await writeBlogJson(postsList);
    pruneOrphanHtml(postsList);
    return postsList;
}

async function generatePostHTML(post) {
    const md = await getMarkdownRenderer();
    const htmlContent = md.render(post.body || "");
    const postDate = new Date(post.created_at).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const filename = filenameFor(post);
    const pageUrl = `${SITE_ORIGIN}/posts/${filename}`;
    const description = escapeHtml(
        extractExcerpt(post.body) || post.title || ""
    );
    const title = escapeHtml(post.title);
    const isoDate = post.created_at
        ? new Date(post.created_at).toISOString()
        : "";

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} - Shashwat Agrawal</title>
        <meta name="description" content="${description}" />
        <meta name="author" content="Shashwat Agrawal" />
        <link rel="canonical" href="${pageUrl}" />

        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${OG_IMAGE}" />
        <meta property="og:image:alt" content="${title}" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Shashwat Agrawal" />
        ${isoDate ? `<meta property="article:published_time" content="${isoDate}" />` : ""}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${OG_IMAGE}" />

        <link rel="apple-touch-icon" sizes="180x180" href="../assets/icons/apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="../assets/icons/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="../assets/icons/favicon-16x16.png">
        <link rel="manifest" href="../assets/icons/site.webmanifest">
        <link rel="stylesheet" href="../style.css" />
    </head>
    <body>
        <div class="container">
            <a href="../index.html" class="back-link">
                < Back to Portfolio
            </a>
            <article>
                <h1>${title}</h1>
                <div class="post-meta">
                    Posted on ${postDate} •
                    <a href="${post.html_url}" target="_blank" rel="noopener noreferrer">
                        Discuss on GitHub
                    </a>
                </div>
                <div class="post-content">
                    ${htmlContent}
                </div>
            </article>
        </div>
        <script>
        document.addEventListener("click", async (e) => {
            const btn = e.target.closest(".copy-btn");
            if (!btn) return;
            const wrapper = btn.closest(".code-wrapper");
            const codeEl = wrapper.querySelector("pre");
            const code = codeEl.textContent.trim();
            btn.disabled = true;
            try {
                await navigator.clipboard.writeText(code);
                btn.textContent = "Copied!";
            } catch (err) {
                console.error(err);
                btn.textContent = "Failed";
            }
            setTimeout(() => {
                btn.textContent = "Copy";
                btn.disabled = false;
            }, 1500);
        });
        </script>
    </body>
    </html>`;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function fullRebuild() {
    console.log("Starting full rebuild...");

    if (fs.existsSync(POSTS_DIR)) {
        fs.rmSync(POSTS_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(POSTS_DIR, { recursive: true });

    const posts = await fetchBlogPosts();
    const postsList = [];

    for (const post of posts) {
        const postMeta = await writePost(post);
        postsList.push(postMeta);
    }

    await writeBlogJson(postsList);
    pruneOrphanHtml(postsList);
}

/**
 * Selective HTML update for one issue. Index always rebuilt from the API.
 * Expects existing posts/ to be seeded from gh-pages when run in CI.
 */
async function selectiveBuild(issueNumber, issueAction) {
    console.log(
        `Starting selective build for issue #${issueNumber} (action=${issueAction})...`
    );

    fs.mkdirSync(POSTS_DIR, { recursive: true });

    const removing =
        issueAction === "closed" || issueAction === "unlabeled";

    if (removing) {
        console.log(`Issue #${issueNumber} removed from blog; deleting HTML.`);
        removePostFilesForIssue(issueNumber);
    } else {
        const post = await fetchSinglePost(issueNumber);
        if (!isBlogPost(post)) {
            console.log(
                `Issue #${issueNumber} is not an open blog post; deleting HTML.`
            );
            removePostFilesForIssue(issueNumber);
        } else {
            await writePost(post);
        }
    }

    // Full catalog from API (cheap). Fill any missing HTML so index never 404s
    // after a wipe or first-time seed miss.
    await syncIndexFromApi({ renderMissing: true });
}

async function main() {
    const issueNumber = process.env.ISSUE_NUMBER;
    const issueAction = process.env.ISSUE_ACTION;

    const selectiveActions = new Set([
        "edited",
        "labeled",
        "closed",
        "unlabeled",
    ]);

    const useSelective =
        issueNumber && selectiveActions.has(issueAction);

    if (useSelective) {
        await selectiveBuild(Number(issueNumber), issueAction);
    } else {
        // push, workflow_dispatch, or unknown: full rebuild
        await fullRebuild();
    }

    console.log("Blog build complete!");
}

main().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
