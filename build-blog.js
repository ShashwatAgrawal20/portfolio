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

    return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(post.title)} - Shashwat Agrawal</title>
        <meta name="description" content="${escapeHtml(post.title)}" />
        <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css"
        />
        <style>
            html {
                scroll-behavior: smooth;
            }
            body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
                min-height: 100vh;
                background-color: #080819;
                color: #f8f8f2;
                line-height: 1.6;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
            }
            .back-link {
                color: #50fa7b;
                text-decoration: none;
                font-size: 1.1em;
                margin-bottom: 20px;
                display: inline-block;
            }
            .back-link:hover {
                color: #ff79c6;
            }
            h1 {
                color: #8be9fd;
                margin-bottom: 0.3em;
                font-size: 2em;
            }
            .post-meta {
                color: #6272a4;
                margin-bottom: 30px;
                font-size: 0.95em;
            }
            .post-meta a {
                color: #6272a4;
                text-decoration: underline dotted;
            }
            .post-meta a:hover {
                color: #ff79c6;
            }
            .post-content {
                color: #f8f8f2;
                font-size: 1.1em;
            }
            .post-content p {
                margin: 1em 0;
            }
            .post-content a {
                color: #50fa7b;
                text-decoration: underline dotted;
            }
            .post-content a:hover {
                color: #ff79c6;
                text-decoration: underline solid;
            }
            .post-content pre {
                background-color: #282a36;
                padding: 15px;
                border-radius: 6px;
                overflow-x: auto;
                color: #f8f8f2;
            }
            .post-content code {
                background-color: #4447a;
                padding: 3px 6px;
                border-radius: 4px;
                font-family: monospace;
            }
            .post-content pre code {
                background-color: transparent;
                padding: 0;
            }
            .post-content img {
                max-width: 100%;
                border-radius: 6px;
            }
            .post-content blockquote {
                color: #6272a4;
                font-style: italic;
                border-left: 4px solid #44475a;
                padding-left: 15px;
                margin-left: 0;
            }
            .post-content h2,
            .post-content h3,
            .post-content h4 {
                color: #ffb86c;
                margin-top: 1.5em;
            }
            .post-content ul,
            .post-content ol {
                padding-left: 2em;
            }
        </style>
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
