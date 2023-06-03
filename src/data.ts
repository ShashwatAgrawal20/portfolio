type Projects = {
    title: string;
    subtitle: string;
    description: string;
    image: string;
    link: string;
}

export const projects: Projects[] = [
    {
        title: "Snake Game",
        subtitle: "JavaScript",
        description: "A simple snake game made with vanilla HTML, CSS and JavaScript",
        image: "/snake.gif",
        link: "https://shashwatagrawal20.github.io/JavaScript_SnakeGame/"
    },
    {
        title: "Krypt",
        subtitle: "WEB3, React, TailwindCSS",
        description: "A simple wallet based on sepolia test network",
        image: "/krypt.gif",
        link: "https://krypt-web3-ten.vercel.app/"
    },
    {
        title: "Instagram Clone",
        subtitle: "NextJS, Firebase, TailwindCSS",
        description: "A simple clone of Instagram made with NextJS and TailwindCSS",
        image: "/instagramclone.gif",
        link: "http://insta-clone-gules.vercel.app/"
    },
    {
        title: "TextUtils",
        subtitle: "ReactJS",
        description: "A simple text utility app made with ReactJS",
        image: "/textutils.gif",
        link: "https://shashwatagrawal20.github.io/Text-Utils-Hosted/"
    },
    {
        title: "Dotfiles",
        subtitle: "Linux",
        description: "My personal dotfiles for Linux",
        image: "/dotfiles.png",
        link: "https://github.com/shashwatagrawal20/dotfiles"
    },
]

export const skills: string[] = ["React", "JavaScript", "TypeScript", "HTML", "CSS", "NodeJS", "Express", "MongoDB", "Python", "C++", "C", "Java", "Git", "GitHub", "Vim", "Linux", "Firebase"];
