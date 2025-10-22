const fs = require("fs");
const path = require("path");
const showdown = require("showdown");
const fetch = require("node-fetch");
const prettier = require("prettier");

const USERNAME = "ShashwatAgrawal20";
const REPO = "portfolio";
const POST_LABEL = "blog-post";

const converter = new showdown.Converter({ emoji: true });

async function fetchBlogPosts() {
    const url = `https://api.github.com/repos/${USERNAME}/${REPO}/issues?labels=${POST_LABEL}&state=open&sort=created&direction=desc`;

    const response = await fetch(url, {
        headers: {
            Authorization: process.env.GITHUB_TOKEN
                ? `token ${process.env.GITHUB_TOKEN}`
                : "",
            "User-Agent": "blog-builder",
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return await response.json();
}

function generatePostHTML(post) {
    const htmlContent = converter.makeHtml(post.body);
    const postDate = new Date(post.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
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

async function build() {
    console.log("Fetching blog posts...");
    const posts = await fetchBlogPosts();
    console.log(`Found ${posts.length} posts`);

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) {
        fs.mkdirSync(postsDir, { recursive: true });
    }

    const postsList = [];
    for (const post of posts) {
        const slug = generateSlug(post.title);
        const filename = `${slug}.html`;
        const filepath = path.join(postsDir, filename);

        console.log(`Generating: ${filename}`);

        const rawHtml = generatePostHTML(post);
        const formattedHtml = await prettier.format(rawHtml, {
            parser: "html",
            tabWidth: 4,
        });

        fs.writeFileSync(filepath, formattedHtml);

        postsList.push({
            title: post.title,
            slug: slug,
            date: post.created_at,
            url: `posts/${filename}`,
            githubUrl: post.html_url,
        });
    }

    const rawJson = JSON.stringify(postsList, null, 2);
    const formattedJson = await prettier.format(rawJson, {
        parser: "json",
        tabWidth: 4,
    });

    fs.writeFileSync(path.join(__dirname, "blog-posts.json"), formattedJson);

    console.log("✅ Blog build complete!");
}

build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
