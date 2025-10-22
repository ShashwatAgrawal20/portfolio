const fs = require("fs");
const path = require("path");
const showdown = require("showdown");
const fetch = require("node-fetch");
const prettier = require("prettier");

const USERNAME = "ShashwatAgrawal20";
const REPO = "portfolio";
const POST_LABEL = "blog-post";
const POSTS_DIR = path.join(__dirname, "posts");
const JSON_PATH = path.join(__dirname, "blog-posts.json");

const converter = new showdown.Converter({ emoji: true });

async function fetchBlogPosts() {
    console.log("Fetching all blog posts...");
    const url = `https://api.github.com/repos/${USERNAME}/${REPO}/issues?labels=${POST_LABEL}&state=open&sort=created&direction=desc`;
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

async function writePost(post) {
    const slug = generateSlug(post.title);
    const filename = `${slug}.html`;
    const filepath = path.join(POSTS_DIR, filename);

    console.log(`Generating: ${filename}`);
    const rawHtml = generatePostHTML(post);
    const formattedHtml = await prettier.format(rawHtml, {
        parser: "html",
        tabWidth: 4,
    });

    fs.writeFileSync(filepath, formattedHtml);

    return {
        title: post.title,
        slug: slug,
        date: post.created_at,
        url: `posts/${filename}`,
        githubUrl: post.html_url,
    };
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

function generatePostHTML(post) {
    const htmlContent = converter.makeHtml(post.body);
    const postDate = new Date(post.created_at).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(post.title)} - Shashwat Agrawal</title>
        <meta name="description" content="${escapeHtml(post.title)}" />
        <link rel="apple-touch-icon" sizes="180x180" href="../apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="../favicon-16x16.png">
        <link rel="manifest" href="../site.webmanifest">
        <link rel="stylesheet" href="../style.css" />
        <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css"
        />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/tokyo-night-dark.min.css">
        </head>
    <body>
        <div class="container">
            <a href="../index.html" class="back-link">
                <i class="fas fa-arrow-left"></i> Back to Portfolio
            </a>
            <article>
                <h1>${escapeHtml(post.title)}</h1>
                <div class="post-meta">
                    Posted on ${postDate} •
                    <a href="${post.html_url}" target="_blank">
                        <i class="fas fa-comment"></i> Discuss on GitHub
                    </a>
                </div>
                <div class="post-content">
                    ${htmlContent}
                </div>
            </article>
        </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    </body>
    </html>`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
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
}

async function incrementalBuild(issueNumber) {
    console.log(`Starting incremental build for issue #${issueNumber}...`);

    const post = await fetchSinglePost(issueNumber);

    const hasLabel = post.labels.some((label) => label.name === POST_LABEL);
    if (post.state !== "open" || !hasLabel) {
        console.log(
            `Issue #${issueNumber} is not an open blog post. Triggering full rebuild to remove it.`
        );
        await fullRebuild();
        return;
    }

    if (!fs.existsSync(POSTS_DIR)) {
        fs.mkdirSync(POSTS_DIR, { recursive: true });
    }

    const newPostMeta = await writePost(post);

    let postsList = [];
    if (fs.existsSync(JSON_PATH)) {
        try {
            postsList = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
        } catch (e) {
            console.warn("Could not parse existing blog-posts.json. Rebuilding.");
            await fullRebuild();
            return;
        }
    }

    const postIndex = postsList.findIndex((p) => p.slug === newPostMeta.slug);
    if (postIndex > -1) {
        postsList[postIndex] = newPostMeta;
    } else {
        postsList.push(newPostMeta);
    }

    await writeBlogJson(postsList);
}

async function main() {
    const issueNumber = process.env.ISSUE_NUMBER;
    const issueAction = process.env.ISSUE_ACTION;

    const isIncremental =
        issueNumber && (issueAction === "edited" || issueAction === "labeled");

    if (isIncremental) {
        await incrementalBuild(issueNumber);
    } else {
        await fullRebuild();
    }

    console.log("✅ Blog build complete!");
}

main().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
