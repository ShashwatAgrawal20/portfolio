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
const FEED_URL = `${SITE_ORIGIN}/feed.xml`;
const POSTS_DIR = path.join(__dirname, "posts");
const JSON_PATH = path.join(__dirname, "blog-posts.json");
const FEED_PATH = path.join(__dirname, "feed.xml");
const WORDS_PER_MINUTE = 200;

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

function countWords(body) {
    const text = String(body || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]+`/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[#>*_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
}

function readingMinutesFromWords(wordCount) {
    return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
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
        permalink: false,
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
                <button type="button" class="copy-btn">Copy</button>
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
    return `${generateSlug(post.title)}.html`;
}

function toMeta(post) {
    const slug = generateSlug(post.title);
    const filename = filenameFor(post);
    const wordCount = countWords(post.body);
    return {
        issueNumber: post.number,
        title: post.title,
        slug,
        date: post.created_at,
        updatedAt: post.updated_at,
        url: `posts/${filename}`,
        githubUrl: post.html_url,
        excerpt: extractExcerpt(post.body),
        wordCount,
        readingMinutes: readingMinutesFromWords(wordCount),
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

function formatDisplayDate(iso) {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function wasUpdatedAfterCreate(createdAt, updatedAt) {
    if (!createdAt || !updatedAt) return false;
    const c = new Date(createdAt).getTime();
    const u = new Date(updatedAt).getTime();
    return u - c > 60 * 1000;
}

async function writePost(post) {
    removePostFilesForIssue(post.number);

    const meta = toMeta(post);
    const filepath = path.join(POSTS_DIR, path.basename(meta.url));

    console.log(`Generating: ${meta.url}`);
    const rawHtml = await generatePostHTML(post, meta);
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
    return meta;
}

function escapeXml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function toRfc822Date(dateInput) {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return new Date().toUTCString();
    return d.toUTCString();
}

function writeRssFeed(postsList) {
    console.log("Generating feed.xml...");
    const sorted = [...postsList].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );
    const lastBuild = sorted.length
        ? toRfc822Date(sorted[0].updatedAt || sorted[0].date)
        : new Date().toUTCString();

    const items = sorted
        .map((post) => {
            const link = `${SITE_ORIGIN}/${post.url}`;
            const title = escapeXml(post.title);
            const description = escapeXml(post.excerpt || post.title || "");
            const pubDate = toRfc822Date(post.date);
            const guid = post.issueNumber
                ? `https://github.com/${USERNAME}/${REPO}/issues/${post.issueNumber}`
                : link;

            return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="${post.issueNumber ? "false" : "true"}">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
        })
        .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Shashwat Agrawal</title>
    <link>${SITE_ORIGIN}/</link>
    <description>Engineering notes - systems, C, tools, and open source.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

    fs.writeFileSync(FEED_PATH, xml);
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
    writeRssFeed(postsList);
}

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

function postPageScript(meta) {
    const slugJson = JSON.stringify(meta.slug);
    return `
        <script>
        (function () {
            const SLUG = ${slugJson};

            document.addEventListener("click", async (e) => {
                const btn = e.target.closest(".copy-btn");
                if (!btn) return;
                const wrapper = btn.closest(".code-wrapper");
                const codeEl = wrapper && wrapper.querySelector("pre");
                if (!codeEl) return;
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

            const copyLinkBtn = document.getElementById("copy-link-btn");
            if (copyLinkBtn) {
                copyLinkBtn.addEventListener("click", async () => {
                    const url = window.location.href.split("#")[0];
                    try {
                        await navigator.clipboard.writeText(url);
                        copyLinkBtn.textContent = "Copied!";
                    } catch (err) {
                        console.error(err);
                        copyLinkBtn.textContent = "Failed";
                    }
                    setTimeout(() => {
                        copyLinkBtn.textContent = "Copy link";
                    }, 1500);
                });
            }

            document.querySelectorAll(".post-content h1[id], .post-content h2[id], .post-content h3[id], .post-content h4[id]").forEach((heading) => {
                heading.style.cursor = "pointer";
                heading.title = "Click to copy link to this section";
                heading.addEventListener("click", async (e) => {
                    if (e.target.closest("a")) return;
                    const url = window.location.href.split("#")[0] + "#" + heading.id;
                    try {
                        await navigator.clipboard.writeText(url);
                        heading.classList.add("heading-copied");
                        setTimeout(() => {
                            heading.classList.remove("heading-copied");
                        }, 1200);
                    } catch (err) {
                        console.error(err);
                    }
                });
            });

            const topBtn = document.getElementById("back-to-top");
            if (topBtn) {
                const onScroll = () => {
                    if (window.scrollY > 400) topBtn.classList.add("visible");
                    else topBtn.classList.remove("visible");
                };
                window.addEventListener("scroll", onScroll, { passive: true });
                onScroll();
                topBtn.addEventListener("click", () => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                });
            }

            const nav = document.getElementById("post-nav");
            if (nav) {
                fetch("../blog-posts.json")
                    .then((r) => (r.ok ? r.json() : []))
                    .then((posts) => {
                        if (!Array.isArray(posts) || !posts.length) return;
                        const idx = posts.findIndex((p) => p.slug === SLUG);
                        if (idx < 0) return;
                        const newer = idx > 0 ? posts[idx - 1] : null;
                        const older = idx < posts.length - 1 ? posts[idx + 1] : null;
                        let html = "";
                        if (older) {
                            html += '<a class="post-nav-prev" href="../' + older.url + '">&larr; ' + escapeHtml(older.title) + "</a>";
                        } else {
                            html += "<span></span>";
                        }
                        if (newer) {
                            html += '<a class="post-nav-next" href="../' + newer.url + '">' + escapeHtml(newer.title) + " &rarr;</a>";
                        } else {
                            html += "<span></span>";
                        }
                        nav.innerHTML = html;
                    })
                    .catch((err) => console.error(err));
            }

            function escapeHtml(text) {
                const d = document.createElement("div");
                d.textContent = text;
                return d.innerHTML;
            }
        })();
        </script>
    `;
}

async function generatePostHTML(post, meta) {
    const md = await getMarkdownRenderer();
    const htmlContent = md.render(post.body || "");
    const postDate = formatDisplayDate(post.created_at);
    const updatedDate = formatDisplayDate(post.updated_at);
    const showUpdated = wasUpdatedAfterCreate(post.created_at, post.updated_at);
    const pageUrl = `${SITE_ORIGIN}/${meta.url}`;
    const description = escapeHtml(meta.excerpt || post.title || "");
    const title = escapeHtml(post.title);
    const isoDate = post.created_at
        ? new Date(post.created_at).toISOString()
        : "";
    const isoUpdated = post.updated_at
        ? new Date(post.updated_at).toISOString()
        : "";

    const updatedMeta = showUpdated
        ? ` · <span class="post-updated">Updated ${updatedDate}</span>`
        : "";
    const readingMeta = ` · <span class="post-reading">${meta.readingMinutes} min read</span>`;
    const wordsMeta = ` · <span class="post-words">${meta.wordCount.toLocaleString("en-US")} words</span>`;

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
        ${isoUpdated ? `<meta property="article:modified_time" content="${isoUpdated}" />` : ""}

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
                    Posted on ${postDate}${updatedMeta}${readingMeta}${wordsMeta} •
                    <a href="${post.html_url}" target="_blank" rel="noopener noreferrer">
                        Discuss on GitHub
                    </a>
                </div>
                <div class="post-actions">
                    <button type="button" class="post-action-btn" id="copy-link-btn">Copy link</button>
                </div>
                <div class="post-content">
                    ${htmlContent}
                </div>
            </article>
            <nav class="post-nav" id="post-nav" aria-label="Adjacent posts"></nav>
        </div>
        <button type="button" id="back-to-top" class="back-to-top" aria-label="Back to top">↑ Top</button>
        ${postPageScript(meta)}
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
        postsList.push(await writePost(post));
    }

    await writeBlogJson(postsList);
    pruneOrphanHtml(postsList);
}

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
        await fullRebuild();
    }

    console.log("Blog build complete!");
}

main().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
